#include "..\Header\Light.h"

Light::Light()
{
	actived = false;
}

Light::Light(const float& p_x, const float& p_y, const float& p_z)
{
	actived = true;
	Position[0] = p_x;
	Position[1] = p_y;
	Position[2] = p_z;
}

DirectionalLight::DirectionalLight()
{
	actived = false;
}

DirectionalLight::DirectionalLight(const float& p_x, const float& p_y, const float& p_z, const float& p_intensity)
{
	actived = true;
	Position[0] = p_x;
	Position[1] = p_y;
	Position[2] = p_z;

	intensity = p_intensity;
}

PointLight::PointLight()
{
	actived = false;
}

PointLight::PointLight(const float& p_x, const float& p_y, const float& p_z, const float& p_intensity, const float& p_c, const float& p_l, const float& p_q)
{
	Position[0] = p_x;
	Position[1] = p_y;
	Position[2] = p_z;

	intensity = p_intensity;
	constant = p_c;
	linear = p_l;
	quadratic = p_q;
}

PbrLight::PbrLight()
{
	actived = false;
}

PbrLight::PbrLight(const float& p_x, const float& p_y, const float& p_z, const float& c_x, const float& c_y, const float& c_z)
{
	Position[0] = p_x;
	Position[1] = p_y;
	Position[2] = p_z;

	lightColor[0] = c_x;
	lightColor[1] = c_y;
	lightColor[2] = c_z;
}
