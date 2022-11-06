#version 430 core
out vec4 FragColor;

in VS_OUT 
{
    vec3 FragPos;
    vec3 Normal;
    vec2 TexCoords;
    vec4 FragPosLightSpace;
} fs_in;

uniform bool is_hard_shadow;
uniform bool is_pcf;
uniform bool is_pcss;

uniform sampler2D shadowMap;
uniform vec3 lightPos;
uniform vec3 viewPos;
uniform bool isShadow;

#define PI 3.141592653589793
#define PI2 6.283185307179586

//采样数
#define NUM_SAMPLES 100
//采样圈数
#define NUM_RINGS 10
//全局参数
vec2 poissonDisk[NUM_SAMPLES];

// 转化为纹理坐标
vec3 coord_trans()
{
    // 转化为标准齐次坐标, z:[-1, 1]
    vec3 projCoords = fs_in.FragPosLightSpace.xyz / fs_in.FragPosLightSpace.w;
    // xyz:[-1, 1] => [0,1]
    projCoords = projCoords * 0.5 + 0.5;
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
    highp float dt = dot( uv.xy, vec2( a,b ) );
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




void main()
{           
    vec3 color = vec3(1.0, 1.0, 1.0);
    vec3 normal = normalize(fs_in.Normal);
    vec3 lightColor = vec3(0.3);
    // ambient
    vec3 ambient = 0.3 * lightColor;
    // diffuse
    vec3 lightDir = normalize(lightPos - fs_in.FragPos);
    float diff = max(dot(lightDir, normal), 0.0);
    vec3 diffuse = diff * lightColor;
    // specular
    vec3 viewDir = normalize(viewPos - fs_in.FragPos);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = 0.0;
    vec3 halfwayDir = normalize(lightDir + viewDir);  
    spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0);
    vec3 specular = spec * lightColor; 
    
    vec3 lighting;
    if(isShadow)
    {
        if(is_hard_shadow)
        {
            float shadow = hard_shadow(normal, lightDir);                      
            lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color; 
        }
        if(is_pcf)
        {
            float shadow = pcf_shadow(normal, lightDir, 2);
            lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color; 
        }
         if(is_pcss)
        {
            float shadow = pcss_shadow(normal, lightDir);
            lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color; 
        }
    }
    else
    {
        lighting = (ambient + diffuse + specular ) * color;
    }
    FragColor = vec4(lighting, 1.0);
}