#version 430 core

#define PI 3.141592653589793
#define PI2 6.283185307179586

#define NUM_SAMPLES 100 // ������
#define NUM_RINGS 10 // ����Ȧ��
vec2 poissonDisk[NUM_SAMPLES]; // ȫ�ֲ���

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

uniform sampler2D diff_texture; // ������ͼ
uniform sampler2D shadowMap; // �����ͼ
uniform bool is_textured; // �����Ƿ���������ͼ
uniform vec3 viewPos; // �����λ��
uniform dir_light d_light; // ����⣬ֻ���㶨������Ӱ
uniform point_light p_light[20]; // ���Դ
uniform int nums_plight; // ���Դ����
uniform material pass_material; // ͨ�ò���
uniform bool is_shadow; // ��Ӱ��ʶ
uniform bool is_hard_shadow; // Ӳ��Ӱ��ʶ
uniform bool is_pcf; // pcf ��Ӱ��ʶ
uniform bool is_pcss; // pcss ��Ӱ��ʶ

vec3 cal_dirlight(); // ���㶨�����ɫ
vec3 cal_pointlight(point_light p_plight); // ������Դ��ɫ
vec3 coord_trans(); // ת��Ϊ��������
highp float rand_2to1(vec2 uv); // ���������
void poissonDiskSamples(const in vec2 randomSeed); // ���ɲ���
float averageBlockDep(vec3 projCoords,vec2 texelSize);
float hard_shadow(vec3 normal, vec3 lightDir); // ����Ӳ��Ӱ
float pcf_shadow(vec3 normal, vec3 lightDir, int radius); // ���� pcf ����Ӱ
float pcss_shadow(vec3 normal, vec3 lightDir);

material gen_material = pass_material; // ��ʽʹ�õĲ��ʣ������޸�

void main()
{
    // �����������ͼ����ʹ��������ͼ������ʹ��ͨ�ò���
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
    vec3 normal = normalize(fs_in.normal); // ����
    vec3 light_dir = normalize(d_light.position - fs_in.fragPos); // ���߷���
    vec3 view_dir = normalize(viewPos - fs_in.fragPos); // �۲췽��
    vec3 reflect_dir = reflect(-light_dir, normal); // ���䷽��

    // ������
    vec3 ambient = gen_material.ambient * light_color;
    // ������
    vec3 diffuse = max(dot(light_dir, normal), 0.0) * light_color * gen_material.diffuse;
    // ���淴��
    vec3 halfway_dir = normalize(light_dir + view_dir);  // �������
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
    vec3 normal = normalize(fs_in.normal); // ����
    vec3 light_dir = normalize(p_plight.position - fs_in.fragPos); // ���߷���
    vec3 view_dir = normalize(viewPos - fs_in.fragPos); // �۲췽��
    vec3 reflect_dir = reflect(-light_dir, normal); // ���䷽��
    float distance = length(p_plight.position - fs_in.fragPos);
    float attenuation = 1.0 / (p_plight.constant +  p_plight.linear * distance + 
                  p_plight.quadratic * (distance * distance));  // ˥��

    // ������
    vec3 ambient = gen_material.ambient * light_color;
    // ������
    vec3 diffuse = max(dot(light_dir, normal), 0.0) * light_color * gen_material.diffuse;
    // ���淴��
    vec3 halfway_dir = normalize(light_dir + view_dir);  // �������
    float spec = pow(max(dot(normal, halfway_dir), 0.0), gen_material.shininess);
    vec3 specular =  spec * light_color * gen_material.specular;

    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;
    
    return (ambient + diffuse + specular);
}

vec3 coord_trans()
{
    vec3 projCoords = fs_in.flightSpace.xyz / fs_in.flightSpace.w; // ת��Ϊ��׼�������, z:[-1, 1]
    projCoords = projCoords * 0.5 + 0.5; // xyz:[-1, 1] => [0,1]
    return projCoords;
}


float hard_shadow(vec3 normal, vec3 lightDir)
{
    vec3 projCoords = coord_trans();
    // �����ͼ�л�ȡ�����Ϣ
    float closestDepth = texture(shadowMap, projCoords.xy).r; 
    // ��ǰƬԪ�����
    float currentDepth = projCoords.z;
    // �ж��Ƿ�����Ӱ����
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    float shadow = (currentDepth - bias) > closestDepth  ? 1.0 : 0.0;
    // �ڹ�׶�� far_plane ����֮��ʱ��������ӰΪ 0.0
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
    //����һ����ά��������һ�����������
    // 0 - 1
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot( uv.xy, vec2( a,b ));
    highp float sn = mod( dt, PI );
    return fract(sin(sn) * c);//ֻȡС�����֣�ȡֵ��Χ0~1����Ϊ��+1��
}

void poissonDiskSamples(const in vec2 randomSeed)
{
    float ANGLE_STEP = PI2 * float(NUM_RINGS)/float( NUM_SAMPLES);//��λ�ƴ�С
    float INV_NUM_SAMPLES = 1.0 / float(NUM_SAMPLES); //�������ĵ���

    float angle = rand_2to1(randomSeed) * PI2;//��ʼ�Ƕȣ����ȣ�
    float radius = INV_NUM_SAMPLES;//��ʼ�뾶
    float radiusStep = radius;     //�뾶����

    for( int i = 0; i < NUM_SAMPLES; i ++ ) 
    {
      poissonDisk[i] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
      radius += radiusStep;//�뾶����
      angle += ANGLE_STEP;//��������
    }
}

float averageBlockDep(vec3 projCoords,vec2 texelSize)
{
    float blockerZ = 0.0;//�ڵ��������
    int count = 0;
    int r=5;
    //��һ����Χ���ж��Ƿ����ڵ���
    poissonDiskSamples(projCoords.xy+vec2(0.1314,0.351));
    for(int i=0;i<NUM_SAMPLES;++i)
    {
        float depth = texture(shadowMap, projCoords.xy + r * poissonDisk[i] * texelSize).r;
        if(depth < projCoords.z)
        {   //���Ϊ�ڵ���
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
    // ȡ�����������(ʹ��[0,1]��Χ�µ�fragPosLight������)
    float closestDepth = texture(shadowMap, projCoords.xy).r;
    // ȡ�õ�ǰƬ���ڹ�Դ�ӽ��µ����
    float currentDepth = projCoords.z;
    // ��鵱ǰƬ���Ƿ�����Ӱ��
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    //ÿ����ƫ�ƾ���
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);

    //PCSS�����㷨
    float visibility = 0.0;
    //��һ������ƽ���ڵ������
    float averBlocker = averageBlockDep(projCoords,texelSize);
    //�ڶ����������Ӱ�뾶
    float penumbra = (projCoords.z - averBlocker) * weightOfLight / averBlocker;
    //������ PCF
    visibility = pcf_shadow(normal, lightDir, int(penumbra));
    return visibility;
}