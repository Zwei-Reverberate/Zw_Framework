#pragma once
#include <glm/glm.hpp>
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <iostream>
#include "../Header/stb_image.h"
class PbrMaterial
{
public:
	glm::vec3 albedo;
	float metallic;
	float roughness;
	float ao;	

	PbrMaterial();
	PbrMaterial(const glm::vec3& p_a, const float& p_m, const float& p_r, const float& p_ao);
};

class PbrMaterialWithTexture
{
public:
	unsigned int albedo;
	unsigned int normal;
	unsigned int metallic;
	unsigned int roughness;
	unsigned int ao;

	PbrMaterialWithTexture();
	static unsigned int loadTexture(const char* path);
};