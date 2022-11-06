#version 430 core

#define PI 3.141592653589793
#define PI2 6.283185307179586

#define NUM_SAMPLES 100 // 采样数
#define NUM_RINGS 10 // 采样圈数
vec2 poissonDisk[NUM_SAMPLES]; // 全局参数

out vec4 FragColor;
in VS_OUT 
{
    vec3 fragPos;
    vec3 normal;
    vec2 texCoords;
    vec4 flightSpace;
} fs_in;

struct material
{
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
    float shininess;
};

struct dir_light 
{
    bool actived;
    vec3 position;
    float intensity;
};

struct point_light
{
    bool actived;
    vec3 position;
    float intensity;
    float constant;
	float linear;
	float quadratic;
};

uniform sampler2D diff_texture; // 纹理贴图
uniform sampler2D shadowMap; // 深度贴图
uniform bool is_textured; // 对象是否有纹理贴图
uniform vec3 viewPos; // 摄像机位置
uniform dir_light d_light; // 定向光，只计算定向光的阴影
uniform point_light p_light[20]; // 点光源
uniform int nums_plight; // 点光源数量
uniform material pass_material; // 通用材质
uniform bool is_shadow; // 阴影标识
uniform bool is_hard_shadow; // 硬阴影标识
uniform bool is_pcf; // pcf 阴影标识
uniform bool is_pcss; // pcss 阴影标识

vec3 cal_dirlight(); // 计算定向光着色
vec3 cal_pointlight(point_light p_plight); // 计算点光源着色
vec3 coord_trans(); // 转化为纹理坐标
highp float rand_2to1(vec2 uv); // 生成随机数
void poissonDiskSamples(const in vec2 randomSeed); // 泊松采样
float averageBlockDep(vec3 projCoords,vec2 texelSize);
float hard_shadow(vec3 normal, vec3 lightDir); // 计算硬阴影
float pcf_shadow(vec3 normal, vec3 lightDir, int radius); // 计算 pcf 软阴影
float pcss_shadow(vec3 normal, vec3 lightDir);

material gen_material = pass_material; // 正式使用的材质，便于修改

void main()
{
    // 如果有纹理贴图，则使用纹理贴图，否则使用通用材质
    if(is_textured)
    {
        gen_material.diffuse = pass_material.diffuse * texture(diff_texture, fs_in.texCoords).rgb;
        gen_material.ambient = pass_material.ambient * texture(diff_texture, fs_in.texCoords).rgb;
        gen_material.specular = pass_material.specular * texture(diff_texture, fs_in.texCoords).rgb;
    }

    vec3 result = cal_dirlight();
    for(int i  = 0; i < nums_plight; i++) result += cal_pointlight(p_light[i]);

    FragColor = vec4(result, 1.0);
}

vec3 cal_dirlight()
{
    vec3 light_color = vec3(1.0f, 1.0f, 1.0f);
    vec3 normal = normalize(fs_in.normal); // 法线
    vec3 light_dir = normalize(d_light.position - fs_in.fragPos); // 光线方向
    vec3 view_dir = normalize(viewPos - fs_in.fragPos); // 观察方向
    vec3 reflect_dir = reflect(-light_dir, normal); // 反射方向

    // 环境光
    vec3 ambient = gen_material.ambient * light_color;
    // 漫反射
    vec3 diffuse = max(dot(light_dir, normal), 0.0) * light_color * gen_material.diffuse;
    // 镜面反射
    vec3 halfway_dir = normalize(light_dir + view_dir);  // 半程向量
    float spec = pow(max(dot(normal, halfway_dir), 0.0), gen_material.shininess);
    vec3 specular =  spec * light_color * gen_material.specular;

    vec3 result;
    if(is_shadow)
    {
        if(is_hard_shadow)
        {
            float shadow = hard_shadow(normal, light_dir);                      
            result = (ambient + (1.0 - shadow) * (diffuse + specular)); 
        }
        if(is_pcf)
        {
            float shadow = pcf_shadow(normal, light_dir, 2);
            result = (ambient + (1.0 - shadow) * (diffuse + specular)); 
        }
         if(is_pcss)
        {
            float shadow = pcss_shadow(normal, light_dir);
            result = ambient + (1.0 - shadow) * (diffuse + specular); 
        }
    }
    else
    {
        result = ambient + diffuse + specular;
    }
    return result;
}

vec3 cal_pointlight(point_light p_plight)
{
    vec3 light_color = vec3(1.0f, 1.0f, 1.0f);
    vec3 normal = normalize(fs_in.normal); // 法线
    vec3 light_dir = normalize(p_plight.position - fs_in.fragPos); // 光线方向
    vec3 view_dir = normalize(viewPos - fs_in.fragPos); // 观察方向
    vec3 reflect_dir = reflect(-light_dir, normal); // 反射方向
    float distance = length(p_plight.position - fs_in.fragPos);
    float attenuation = 1.0 / (p_plight.constant +  p_plight.linear * distance + 
                  p_plight.quadratic * (distance * distance));  // 衰减

    // 环境光
    vec3 ambient = gen_material.ambient * light_color;
    // 漫反射
    vec3 diffuse = max(dot(light_dir, normal), 0.0) * light_color * gen_material.diffuse;
    // 镜面反射
    vec3 halfway_dir = normalize(light_dir + view_dir);  // 半程向量
    float spec = pow(max(dot(normal, halfway_dir), 0.0), gen_material.shininess);
    vec3 specular =  spec * light_color * gen_material.specular;

    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;
    
    return (ambient + diffuse + specular);
}

vec3 coord_trans()
{
    vec3 projCoords = fs_in.flightSpace.xyz / fs_in.flightSpace.w; // 转化为标准齐次坐标, z:[-1, 1]
    projCoords = projCoords * 0.5 + 0.5; // xyz:[-1, 1] => [0,1]
    return projCoords;
}


float hard_shadow(vec3 normal, vec3 lightDir)
{
    vec3 projCoords = coord_trans();
    // 在深度图中获取深度信息
    float closestDepth = texture(shadowMap, projCoords.xy).r; 
    // 当前片元的深度
    float currentDepth = projCoords.z;
    // 判断是否处于阴影当中
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    float shadow = (currentDepth - bias) > closestDepth  ? 1.0 : 0.0;
    // 在光锥的 far_plane 区域之外时，保持阴影为 0.0
    if(projCoords.z > 1.0)
        shadow = 0.0;
    return shadow;
}

float pcf_shadow(vec3 normal, vec3 lightDir, int radius)
{
    vec3 projCoords = coord_trans();
    float closestDepth = texture(shadowMap, projCoords.xy).r; 
    float currentDepth = projCoords.z;
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for(int x = -radius; x <= radius; ++x)
    {
        for(int y = -radius; y <= radius; ++y)
        {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;        
        }    
    }
    shadow /= (2*radius+1)*(2*radius+1);
    
    if(projCoords.z > 1.0)
        shadow = 0.0;
        
    return shadow;
}

highp float rand_2to1(vec2 uv ) 
{   
    //传入一个二维数，传出一个假随机数。
    // 0 - 1
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot( uv.xy, vec2( a,b ));
    highp float sn = mod( dt, PI );
    return fract(sin(sn) * c);//只取小数部分（取值范围0~1，若为负+1）
}

void poissonDiskSamples(const in vec2 randomSeed)
{
    float ANGLE_STEP = PI2 * float(NUM_RINGS)/float( NUM_SAMPLES);//角位移大小
    float INV_NUM_SAMPLES = 1.0 / float(NUM_SAMPLES); //采样数的倒数

    float angle = rand_2to1(randomSeed) * PI2;//初始角度（弧度）
    float radius = INV_NUM_SAMPLES;//初始半径
    float radiusStep = radius;     //半径增量

    for( int i = 0; i < NUM_SAMPLES; i ++ ) 
    {
      poissonDisk[i] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
      radius += radiusStep;//半径增加
      angle += ANGLE_STEP;//弧度增加
    }
}

float averageBlockDep(vec3 projCoords,vec2 texelSize)
{
    float blockerZ = 0.0;//遮挡物总深度
    int count = 0;
    int r=5;
    //在一定范围内判断是否有遮挡物
    poissonDiskSamples(projCoords.xy+vec2(0.1314,0.351));
    for(int i=0;i<NUM_SAMPLES;++i)
    {
        float depth = texture(shadowMap, projCoords.xy + r * poissonDisk[i] * texelSize).r;
        if(depth < projCoords.z)
        {   //如果为遮挡物
            count++;
            blockerZ +=depth;
        }
    }

    if(count == 0||count==(r*2+1)*(r*2+1))return 1.0f;
    return blockerZ / count;
}

float pcss_shadow(vec3 normal, vec3 lightDir)
{
    vec3 projCoords = coord_trans();
    const float weightOfLight = 10.0;
    // 取得最近点的深度(使用[0,1]范围下的fragPosLight当坐标)
    float closestDepth = texture(shadowMap, projCoords.xy).r;
    // 取得当前片段在光源视角下的深度
    float currentDepth = projCoords.z;
    // 检查当前片段是否在阴影中
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    //每像素偏移距离
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);

    //PCSS核心算法
    float visibility = 0.0;
    //第一步计算平均遮挡物深度
    float averBlocker = averageBlockDep(projCoords,texelSize);
    //第二步，计算半影半径
    float penumbra = (projCoords.z - averBlocker) * weightOfLight / averBlocker;
    //第三步 PCF
    visibility = pcf_shadow(normal, lightDir, int(penumbra));
    return visibility;
}