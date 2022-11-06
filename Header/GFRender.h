#pragma once
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <glm/glm.hpp>
#include <random>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include "../Header/SkyBox.h"
#include "../Imgui/imgui.h"
#include "../Imgui/imgui_impl_glfw.h"
#include "../Imgui/imgui_impl_opengl3.h"
#include "../Imgui/imgui_internal.h"
#include "../Header/Camera.h"
#include "../Header/Model.h"
#include "../Header/Global.h"
#include "../Header/Light.h"
#include "../Header/Material.h"
#include "../Header/PbrMaterial.h"

class GFRender
{
private:
	GLFWwindow* window;
	GLFWwindow* createWindow();	
private:
	Shader shadowMapShader;
	Shader simpleDepthShader;
	Shader whiteShader;
	Shader phongShader;
	Shader depthShader;
	Shader customShader;
	Shader standardShader;
	Shader skyBoxShader;
	Shader pbrShader;
	Model marry;
	Model plane;
	Model sphere;
	Material defaultMaterial = Material(glm::vec3(0.1f), glm::vec3(0.8f), glm::vec3(0.2f), 64.0f);
	unsigned int depthMapFBO;
	unsigned int depthMap;
	void setupDepthMap();
	void setupShader();
	void display();

// Global Settings
private:
	bool show_global_setting = false;
	bool is_shadow = false;
	int ma_e = 0;
	// Position of directional light
	// float lightPosition[3] = {-2.0f, 4.0f, -1.0f};
	DirectionalLight dirLight = DirectionalLight(-2.0f, 4.0f, -1.0f, 1.0f);
	PointLight pointLight[2];
	const int pointNum = 2;
	SkyBox skyBox;
	bool is_renderout_skyBox = false;
	bool is_anti_aliasing = false;
	void setupLight();
	void showGlobalSettingWindow(bool* p_open);
	void shadowModeSet(Shader& shader);


// Imgui
private:
	void initimGui();
	void renderGui();
	void guiWork(); // Make our Gui here
	void shutDownGui();

	bool show_marry_window = false;
	bool is_renderout_marry = false;
	bool is_shadow_marry = false;
	float marryPosition[3] = { 0.0f, 0.0f, 0.0f };
	float marryRotate[3] = { 0.0f, 0.0f, 0.0f };
	float marryScale[3] = { 0.5f, 0.5f, 0.5f };
	unsigned int marryTexture;
	void showMarryWindow(bool* p_open);

	bool show_sphere_window = false;
	bool is_renderout_sphere = false;
	bool is_shadow_sphere = false;
	float spherePosition[3] = { 0.0f, 0.5f, 0.0f };
	float sphereRotate[3] = { 0.0f, 0.0f, 0.0f };
	float sphereScale[3] = { 0.5f, 0.5f, 0.5f };
	void showSphereWindow(bool* p_open);
	
	// Depth Map
	bool show_depth_map = false;
	unsigned int quadVAO = 0;
	unsigned int quadVBO;
	void renderQuad();

private:
	bool fragment_shader_mode = false;
	unsigned int fragVAO;
	unsigned int fragVBO;
	void renderFragment();


public:
	void RenderLoop();
	GFRender();

public:
	void standardShaderSet(bool is_tex, glm::mat4 model, glm::mat4 view, glm::mat4 projection, bool isShadow, glm::mat4 lig_mat);

// PBR rendering
public:
	bool is_pbr_sphere = false;
	bool is_pbr_plane = false;
	bool is_pbr_marry = false;
	PbrMaterial pbrMaterial;
	PbrLight pbrLight[6];
	PbrMaterialWithTexture spherePbrTexture;
	bool is_pbr_withTexture = false;
	void spherePbrTextureLoad();
	void pbrSetting();
	void pbrShaderSet(glm::mat4 model, glm::mat4 view, glm::mat4 projection, glm::vec3 viewPos, bool istextured);
};


// Callbcak Functions
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
void processInput(GLFWwindow* window);
void timing();


// camera
__declspec(selectany)Camera camera(glm::vec3(0.0f, 1.0f, 3.0f));
__declspec(selectany)float lastX = (float)glo::SCR_WIDTH / 2.0;
__declspec(selectany)float lastY = (float)glo::SCR_HEIGHT / 2.0;
__declspec(selectany)bool firstMouse = true;
// timing
__declspec(selectany)float deltaTime = 0.0f;
__declspec(selectany)float lastFrame = 0.0f;
