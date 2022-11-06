#pragma once
#include <glm/glm.hpp>
class Material
{
public:
	glm::vec3 ambient;
	glm::vec3 diffuse;
	glm::vec3 specular;
	float shininess;

	Material();
	Material
	(
		const glm::vec3& p_a,
		const glm::vec3& p_d,
		const glm::vec3& p_s,
		const float& p_sh
	);
};