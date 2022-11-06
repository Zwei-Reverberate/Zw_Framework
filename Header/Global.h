#pragma once
#include <glm/glm.hpp>

namespace glo
{
	const int SCR_WIDTH = 1280;
	const int SCR_HEIGHT = 720;
	const char WINDOW_NAME[] = "ZW_FrameWork";
	const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
}

namespace cam
{
	const glm::vec3 defaultCameraPosition = glm::vec3(0.0f, 0.0f, 3.0f);
}