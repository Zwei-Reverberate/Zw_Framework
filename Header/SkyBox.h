#pragma once
#include <vector>
#include <string>
#include <iostream>
#include <glad/glad.h>
#include <fstream>
#include <sstream>
#include <GLFW/glfw3.h>
#include "../Header/stb_image.h"

class SkyBox
{
public:
	SkyBox();
	unsigned int skyboxVAO, skyboxVBO;
	unsigned int cubemapTexture;
	unsigned int loadCubemap(std::vector <std::string> faces);

	void skyBoxSetting();
	void skyTextureLoad();
};