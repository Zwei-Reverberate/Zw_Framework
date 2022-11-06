#pragma once
#include <glm/glm.hpp>
#include <random>
class Light
{
public:
	bool actived;
	float Position[3];
	Light();
	Light(const float& p_x, const float& p_y, const float& p_z);
};

class DirectionalLight : public Light
{
public:
	float intensity;
	DirectionalLight();
	DirectionalLight(const float& p_x, const float& p_y, const float& p_z,
					 const float& p_intensity);
};

class PointLight : public Light
{
public:
	float intensity;
	float constant;
	float linear;
	float quadratic;

	PointLight();
	PointLight(const float& p_x, const float& p_y, const float& p_z,
			   const float& p_intensity,
			   const float& p_c, const float& p_l, const float& p_q);
};

class PbrLight : public Light
{
public:
	float lightColor[3];
	PbrLight();
	PbrLight(const float& p_x, const float& p_y, const float& p_z,
		     const float& c_x, const float& c_y, const float& c_z);
};