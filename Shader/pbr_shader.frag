#version 430 core
out vec4 FragColor;
in vec2 tex_coords;
in vec3 world_pos;
in vec3 normal;

struct pbr_material
{
	vec3 albedo; // 反照率
	float metallic; // 金属度
	float roughness; // 粗糙度
	float ao; // 环境光遮蔽
};

struct pbr_light
{
    bool actived;
	vec3 light_pos;
	vec3 light_color;
};

uniform pbr_material pbr_mc;
uniform pbr_light pbr_lip[6];
uniform vec3 cam_pos;

uniform bool is_pbr_textured;
uniform bool is_pbr_for_marry;
uniform sampler2D albedoMap;
uniform sampler2D normalMap;
uniform sampler2D metallicMap;
uniform sampler2D roughnessMap;
uniform sampler2D aoMap;
uniform sampler2D marryMap;


const float PI = 3.14159265359;

float DistributionGGX(vec3 N, vec3 H, float roughness); // 法线分布函数
float GeometrySchlickGGX(float NdotV, float roughness);
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness); // 几何函数
vec3 fresnelSchlick(float cosTheta, vec3 F0); // 菲涅尔方程


vec3 getNormalFromMap();

void main()
{
    vec3 albedo;
    float metallic;
    float roughness;
    float ao;
    vec3 N;

    if(is_pbr_textured)
    {
        albedo = pow(texture(albedoMap, tex_coords).rgb, vec3(2.2));
        metallic  = texture(metallicMap, tex_coords).r;
        roughness = texture(roughnessMap, tex_coords).r;
        ao = texture(aoMap, tex_coords).r;
        N = getNormalFromMap();
    }
    else
    {
        albedo = pbr_mc.albedo;
        metallic = pbr_mc.metallic;
        roughness = pbr_mc.roughness;
        ao = pbr_mc.ao;
        N = normalize(normal);
    }
    
    if(is_pbr_for_marry) albedo = pow(texture(marryMap, tex_coords).rgb, vec3(2.2));
  
    vec3 V = normalize(cam_pos - world_pos);

    // 反射率  
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, albedo, metallic);

    // reflectance equation
    vec3 Lo = vec3(0.0);
    for(int i = 0; i < 6; ++i) 
    {
        // calculate per-light radiance
        vec3 L = normalize(pbr_lip[i].light_pos - world_pos);
        vec3 H = normalize(V + L);
        float distance = length(pbr_lip[i].light_pos - world_pos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = pbr_lip[i].light_color * attenuation;

        // Cook-Torrance BRDF
        float NDF = DistributionGGX(N, H, roughness);   
        float G   = GeometrySmith(N, V, L, roughness);      
        vec3 F    = fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);
           
        vec3 numerator    = NDF * G * F; 
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // + 0.0001 to prevent divide by zero
        vec3 specular = numerator / denominator;
        
        // kS is equal to Fresnel
        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;	  

        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0);        

        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }   
    
    // ambient lighting (note that the next IBL tutorial will replace 
    // this ambient lighting with environment lighting).
    vec3 ambient = vec3(0.03) * albedo *pbr_mc.ao;

    vec3 color = ambient + Lo;

    // HDR tonemapping
    color = color / (color + vec3(1.0));
    // gamma correct
    color = pow(color, vec3(1.0/2.2)); 

    FragColor = vec4(color, 1.0);
}


float DistributionGGX(vec3 N, vec3 H, float roughness)
{
	float a = roughness*roughness;
    float a2 = a*a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}
float GeometrySchlickGGX(float NdotV, float roughness)
{
	float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 getNormalFromMap()
{
    vec3 tangentNormal = texture(normalMap, tex_coords).xyz * 2.0 - 1.0;

    vec3 Q1  = dFdx(world_pos);
    vec3 Q2  = dFdy(world_pos);
    vec2 st1 = dFdx(tex_coords);
    vec2 st2 = dFdy(tex_coords);

    vec3 N   = normalize(normal);
    vec3 T  = normalize(Q1*st2.t - Q2*st1.t);
    vec3 B  = -normalize(cross(N, T));
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}