#include "..\Header\Material.h"

Material::Material()
{
}

Material::Material(const glm::vec3& p_a, const glm::vec3& p_d, const glm::vec3& p_s, const float& p_sh)
{
	ambient = p_a;
	diffuse = p_d;
	specular = p_s;
	shininess = p_sh;
}