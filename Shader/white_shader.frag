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

//������
#define NUM_SAMPLES 100
//����Ȧ��
#define NUM_RINGS 10
//ȫ�ֲ���
vec2 poissonDisk[NUM_SAMPLES];

// ת��Ϊ��������
vec3 coord_trans()
{
    // ת��Ϊ��׼�������, z:[-1, 1]
    vec3 projCoords = fs_in.FragPosLightSpace.xyz / fs_in.FragPosLightSpace.w;
    // xyz:[-1, 1] => [0,1]
    projCoords = projCoords * 0.5 + 0.5;
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
    highp float dt = dot( uv.xy, vec2( a,b ) );
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