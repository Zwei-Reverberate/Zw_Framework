#include "../Header/GFRender.h"

GLFWwindow* GFRender::createWindow()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_SAMPLES, 4); // Anti-aliasing
    GLFWwindow* window = glfwCreateWindow(glo::SCR_WIDTH, glo::SCR_HEIGHT, glo::WINDOW_NAME, nullptr, nullptr);
    if (window == nullptr)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        exit(-1);
    }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, mouse_callback);
    glfwSetScrollCallback(window, scroll_callback);
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        exit(-1);
    }
    glEnable(GL_MULTISAMPLE);
    glEnable(GL_DEPTH_TEST);
    return window;
}

void GFRender::setupDepthMap()
{
    glGenFramebuffers(1, &depthMapFBO);
    // create depth texture
    glGenTextures(1, &depthMap);
    glBindTexture(GL_TEXTURE_2D, depthMap);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, glo::SHADOW_WIDTH, glo::SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    // attach depth texture as FBO's depth buffer
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);
    glDrawBuffer(GL_NONE);
    glReadBuffer(GL_NONE);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

void GFRender::setupShader()
{
    shadowMapShader.use();
    shadowMapShader.setInt("diffuseTexture", 0);
    shadowMapShader.setInt("shadowMap", 1);
    whiteShader.use();
    whiteShader.setInt("depthMap", 0);
    standardShader.use();
    standardShader.setInt("diff_texture", 0);
    standardShader.setInt("shadowMap", 1);
    depthShader.use();
    depthShader.setInt("depthMap", 0);
    skyBoxShader.use();
    skyBoxShader.setInt("skybox", 0);
    pbrShader.use();
    pbrShader.setInt("albedoMap", 0);
    pbrShader.setInt("normalMap", 1);
    pbrShader.setInt("metallicMap", 2);
    pbrShader.setInt("roughnessMap", 3);
    pbrShader.setInt("aoMap", 4);
    pbrShader.setInt("marryMap", 5);
}

void GFRender::display()
{
    glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glm::vec3 lightPos = glm::vec3(dirLight.Position[0], dirLight.Position[1], dirLight.Position[2]);
    glm::mat4 defaultModel = glm::mat4(1.0f);
    glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)glo::SCR_WIDTH / (float)glo::SCR_HEIGHT, 0.1f, 100.0f);
    glm::mat4 view = camera.GetViewMatrix();
    glm::mat4 lightProjection, lightView;
    glm::mat4 lightSpaceMatrix;
    float near_plane = 1.0f, far_plane = 7.5f;
    lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, near_plane, far_plane);
    lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
    lightSpaceMatrix = lightProjection * lightView;
    bool isShadow = false;

    glm::mat4 marryModel = glm::translate(defaultModel, glm::vec3(marryPosition[0], marryPosition[1], marryPosition[2]));
    marryModel = glm::rotate(marryModel, glm::radians(marryRotate[0]), glm::vec3(1, 0, 0));
    marryModel = glm::rotate(marryModel, glm::radians(marryRotate[1]), glm::vec3(0, 1, 0));
    marryModel = glm::rotate(marryModel, glm::radians(marryRotate[2]), glm::vec3(0, 0, 1));
    marryModel = glm::scale(marryModel, glm::vec3(marryScale[0], marryScale[1], marryScale[2]));

    glm::mat4 sphereModel = glm::translate(defaultModel, glm::vec3(spherePosition[0], spherePosition[1], spherePosition[2]));
    sphereModel = glm::rotate(sphereModel, glm::radians(sphereRotate[0]), glm::vec3(1, 0, 0));
    sphereModel = glm::rotate(sphereModel, glm::radians(sphereRotate[1]), glm::vec3(0, 1, 0));
    sphereModel = glm::rotate(sphereModel, glm::radians(sphereRotate[2]), glm::vec3(0, 0, 1));
    sphereModel = glm::scale(sphereModel, glm::vec3(sphereScale[0], sphereScale[1], sphereScale[2]));


    if (is_shadow)
    {
        isShadow = true;
        simpleDepthShader.use();
        simpleDepthShader.setMat4("lightSpaceMatrix", lightSpaceMatrix);
        simpleDepthShader.setMat4("model", defaultModel);
        glViewport(0, 0, glo::SHADOW_WIDTH, glo::SHADOW_HEIGHT);
        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
        glClear(GL_DEPTH_BUFFER_BIT);
        plane.Draw(simpleDepthShader);
        if (is_shadow_marry && is_renderout_marry)
        {
            simpleDepthShader.setMat4("model", marryModel);
            marry.Draw(simpleDepthShader);
        }
        if (is_shadow_sphere && is_renderout_sphere)
        {
            simpleDepthShader.setMat4("model", sphereModel);
            sphere.Draw(simpleDepthShader);
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        int width = glo::SCR_WIDTH;
        int height = glo::SCR_HEIGHT;
        glfwGetWindowSize(window, &width, &height);
        glViewport(0, 0, width, height);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    }

    // Show depth Map
    if (show_depth_map)
    {
        depthShader.use();
        depthShader.setFloat("near_plane", near_plane);
        depthShader.setFloat("far_plane", far_plane);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        renderQuad();
    }
    else
    {
        if (is_renderout_marry)
        {
            if (is_pbr_marry)
            {
                pbrShaderSet(marryModel, view, projection, camera.Position, is_pbr_withTexture);
                marry.Draw(pbrShader);
            }
            else
            {
                standardShaderSet(true, marryModel, view, projection, is_shadow_marry, lightSpaceMatrix);
                marry.Draw(standardShader);
            }
        }

        if (is_renderout_sphere)
        {
            if (is_pbr_sphere)
            {
                pbrShaderSet(sphereModel, view, projection, camera.Position, is_pbr_withTexture);
                sphere.Draw(pbrShader);
            }
            else
            {
              standardShaderSet(false, sphereModel, view, projection, is_shadow_sphere, lightSpaceMatrix);
              sphere.Draw(standardShader);
            }
        }
        if (is_pbr_plane)
        {
            pbrShaderSet(defaultModel, view, projection, camera.Position, false);
            plane.Draw(pbrShader);
        }
        else
        {
            standardShaderSet(false, defaultModel, view, projection, isShadow, lightSpaceMatrix);
            plane.Draw(standardShader);
        }
    }

    if (is_renderout_skyBox)
    {
        // draw skybox as last
        glDepthFunc(GL_LEQUAL);  // change depth function so depth test passes when values are equal to depth buffer's content
        skyBoxShader.use();
        skyBoxShader.setMat4("view", view);
        skyBoxShader.setMat4("projection", projection);
        glBindVertexArray(skyBox.skyboxVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_CUBE_MAP, skyBox.cubemapTexture);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
        glDepthFunc(GL_LESS); // set depth function ba
    }
}

void GFRender::setupLight()
{
    // 生成随机位置的点光源
    std::default_random_engine dre;
    std::uniform_real_distribution<float> di(-10.0f, 10.0f);
    for (int i = 0; i < pointNum; i++)
    {
        pointLight[i].actived = true;
        pointLight[i].Position[0] = di(dre);
        pointLight[i].Position[1] = di(dre);
        pointLight[i].Position[2] = di(dre);
        pointLight[i].constant = 1.0f;
        pointLight[i].linear = 0.09f;
        pointLight[i].quadratic = 0.032f;
    }
}

void GFRender::showGlobalSettingWindow(bool* p_open)
{
    if (ImGui::Begin("Global Setting", p_open))
    {
        ImGui::Checkbox("Open Shadow", &is_shadow);
        ImGui::Checkbox("Load Sky Box", &is_renderout_skyBox);
        ImGui::Checkbox("Enable Anti Aliasing", &is_anti_aliasing);
        ImGui::RadioButton("Hard Shadow", &ma_e, 0); ImGui::SameLine();
        ImGui::RadioButton("PCF", &ma_e, 1); ImGui::SameLine();
        ImGui::RadioButton("PCSS", &ma_e, 2); ImGui::NewLine();
        ImGui::InputFloat3("Light Position", dirLight.Position);
        ImGui::NewLine();
        ImGui::Checkbox("Plane Pbr", &is_pbr_plane);
        ImGui::End();
    }
}

void GFRender::shadowModeSet(Shader& shader)
{
    if (ma_e == 0) { shader.setBool("is_hard_shadow", true); shader.setBool("is_pcf", false); shader.setBool("is_pcss", false); }
    if (ma_e == 1) { shader.setBool("is_pcf", true);  shader.setBool("is_hard_shadow", false); shader.setBool("is_pcss", false); }
    if (ma_e == 2) { shader.setBool("is_pcss", true); shader.setBool("is_hard_shadow", false); shader.setBool("is_pcf", false); }
}

void GFRender::initimGui()
{
    IMGUI_CHECKVERSION();
    ImGui::CreateContext(nullptr);
    ImGuiIO& io = ImGui::GetIO();
    (void)io;
    ImGui::StyleColorsDark();
    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init("#version 430");
}

void GFRender::renderGui()
{
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();
    ImGui::NewFrame();
    guiWork();
    ImGui::Render();
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}

void GFRender::guiWork()
{
    if (show_marry_window) { showMarryWindow(&show_marry_window); }
    if (show_sphere_window) { showSphereWindow(&show_sphere_window); }
    if (show_global_setting) { showGlobalSettingWindow(&show_global_setting); }
    ImGui::BeginMainMenuBar();
    if (ImGui::BeginMenu("Model"))
    {
        ImGui::MenuItem("Marry", nullptr, &show_marry_window);
        ImGui::MenuItem("Sphere", nullptr, &show_sphere_window);
        ImGui::EndMenu();
    }
    if (ImGui::BeginMenu("Settings"))
    {
        ImGui::MenuItem("Global Settings", nullptr, &show_global_setting);
        ImGui::MenuItem("Show DepthMap", nullptr, &show_depth_map);
        ImGui::MenuItem("Fragment Shader Mode", nullptr, &fragment_shader_mode);
        ImGui::EndMenu();
    }
    ImGui::EndMainMenuBar();
}

void GFRender::shutDownGui()
{
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
}

void GFRender::showMarryWindow(bool* p_open)
{
    if (ImGui::Begin("Marry", p_open))
    {
        ImGui::Checkbox("Render Out", &is_renderout_marry);
        ImGui::Checkbox("Open Shadow", &is_shadow_marry);
        ImGui::InputFloat3("Position", marryPosition);
        ImGui::InputFloat3("Rotate", marryRotate);
        ImGui::InputFloat3("Scale", marryScale);

        ImGui::NewLine();
        ImGui::Checkbox("Use PBR", &is_pbr_marry);
        ImGui::SliderFloat("metallic", &pbrMaterial.metallic, 0.0f, 1.0f);
        ImGui::SliderFloat("roughness", &pbrMaterial.roughness, 0.0f, 1.0f);
        ImGui::End();
    }
}

void GFRender::showSphereWindow(bool* p_open)
{
    if (ImGui::Begin("Sphere", p_open))
    {
        ImGui::Checkbox("Render Out", &is_renderout_sphere);
        ImGui::Checkbox("Open Shadow", &is_shadow_sphere);
        ImGui::InputFloat3("Position", spherePosition);
        ImGui::InputFloat3("Rotate", sphereRotate);
        ImGui::InputFloat3("Scale", sphereScale);

        ImGui::NewLine();
        ImGui::Checkbox("Use PBR", &is_pbr_sphere);
        ImGui::Checkbox("Use PBR Texture", &is_pbr_withTexture);
        ImGui::SliderFloat("metallic", &pbrMaterial.metallic, 0.0f, 1.0f);
        ImGui::SliderFloat("roughness", &pbrMaterial.roughness, 0.0f, 1.0f);
        ImGui::End();
    }
}

// renderQuad() renders a 1x1 XY quad in NDC
void GFRender::renderQuad()
{
    if (quadVAO == 0)
    {
        float quadVertices[] = 
        {
            // positions        // texture Coords
            -1.0f,  1.0f, 0.0f, 0.0f, 1.0f,
            -1.0f, -1.0f, 0.0f, 0.0f, 0.0f,
             1.0f,  1.0f, 0.0f, 1.0f, 1.0f,
             1.0f, -1.0f, 0.0f, 1.0f, 0.0f,
        };
        // setup plane VAO
        glGenVertexArrays(1, &quadVAO);
        glGenBuffers(1, &quadVBO);
        glBindVertexArray(quadVAO);
        glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), &quadVertices, GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    }
    glBindVertexArray(quadVAO);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    glBindVertexArray(0);
}

void GFRender::renderFragment()
{
    const float coordArray[4][2] =
    {
        {-1.0f, -1.0f},
        { 1.0f, -1.0f},
        {-1.0f,  1.0f},
        { 1.0f,  1.0f}
    };
    glGenVertexArrays(1, &fragVAO);
    glGenBuffers(1, &fragVBO);
    glBindVertexArray(fragVAO);
    glBindBuffer(GL_ARRAY_BUFFER, fragVBO);
    glBufferData(GL_ARRAY_BUFFER, 8 * sizeof(GLfloat), &coordArray[0][0], GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, nullptr);
    glEnableVertexAttribArray(0);

    glBindVertexArray(fragVAO);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    glBindVertexArray(0);
}

void GFRender::RenderLoop()
{
    if (window == nullptr) { exit(EXIT_FAILURE); }
    initimGui();
    while (!glfwWindowShouldClose(window))
    {
        timing();
        processInput(window);
        if (fragment_shader_mode)
        {
            glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            customShader.use();
            customShader.setFloat("u_time", static_cast<float>(glfwGetTime()));
            int h, w = 0;
            glfwGetWindowSize(window, &w, &h);
            customShader.setVec2("u_resolution", glm::vec2(w, h));
            renderFragment();
        }
        else
        {
            display();
        }
        renderGui();
        glfwSwapBuffers(window);
        glfwPollEvents();
    }
    shutDownGui();
    glfwTerminate();
}

GFRender::GFRender()
{
    window = createWindow();
    shadowMapShader = Shader("../Shader/shadow_mapping.vert", "../Shader/shadow_mapping.frag");
    simpleDepthShader = Shader("../Shader/shadow_mapping_depth.vert", "../Shader/shadow_mapping_depth.frag");
    whiteShader = Shader("../Shader/white_shader.vert", "../Shader/white_shader.frag");
    phongShader = Shader("../Shader/phong.vert", "../Shader/phong.frag");
    depthShader = Shader("../Shader/debug_quad.vert", "../Shader/debug_quad.frag");
    customShader = Shader("../Shader/custom_shader.vert", "../Shader/custom_shader.frag");
    standardShader = Shader("../Shader/standard_shader.vert", "../Shader/standard_shader.frag");
    skyBoxShader = Shader("../Shader/sky_box.vert", "../Shader/sky_box.frag");
    pbrShader = Shader("../Shader/pbr_shader.vert", "../Shader/pbr_shader.frag");
    marry = Model("../Assert/Marry/Marry.obj");
    plane = Model("../Assert/Plane/Plane.obj");
    sphere = Model("../Assert/Sphere/Sphere.obj");
    marryTexture = PbrMaterialWithTexture::loadTexture("../Texture/marry/marry.png");
    skyBox.skyBoxSetting();
    skyBox.skyTextureLoad();
    spherePbrTextureLoad();
    pbrSetting();
    setupDepthMap();
    setupLight();
    setupShader();
}

void GFRender::standardShaderSet(bool is_tex, glm::mat4 model, glm::mat4 view, glm::mat4 projection, bool isShadow, glm::mat4 lig_mat)
{
    standardShader.use();

    standardShader.setMat4("model", model);
    standardShader.setMat4("projection", projection);
    standardShader.setMat4("view", view);
    standardShader.setMat4("lightSpaceMatrix", lig_mat);

    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, depthMap);
    shadowModeSet(standardShader);
    standardShader.setBool("is_textured", is_tex);
    standardShader.setVec3("viewPos", camera.Position);
    standardShader.setBool("is_shadow", isShadow);
    standardShader.setBool("d_light.actived", dirLight.actived);
    standardShader.setVec3("d_light.position", glm::vec3(dirLight.Position[0], dirLight.Position[1], dirLight.Position[2]));
    standardShader.setFloat("d_light.intensity", dirLight.intensity);
    
    standardShader.setInt("nums_plight", pointNum);
    standardShader.setBool("p_light[0].actived", pointLight[0].actived);
    standardShader.setVec3("p_light[0].position", glm::vec3(pointLight[0].Position[0], pointLight[0].Position[1], pointLight[0].Position[2]));
    standardShader.setFloat("p_light[0].intensity", pointLight[0].intensity);
    standardShader.setFloat("p_light[0].constant", pointLight[0].constant);
    standardShader.setFloat("p_light[0].linear", pointLight[0].linear);
    standardShader.setFloat("p_light[0].quadratic", pointLight[0].quadratic);
    standardShader.setBool("p_light[1].actived", pointLight[1].actived);
    standardShader.setVec3("p_light[1].position", glm::vec3(pointLight[1].Position[0], pointLight[1].Position[1], pointLight[0].Position[2]));
    standardShader.setFloat("p_light[1].intensity", pointLight[1].intensity);
    standardShader.setFloat("p_light[1].constant", pointLight[1].constant);
    standardShader.setFloat("p_light[1].linear", pointLight[1].linear);
    standardShader.setFloat("p_light[1].quadratic", pointLight[1].quadratic);

    standardShader.setVec3("pass_material.ambient", defaultMaterial.ambient);
    standardShader.setVec3("pass_material.diffuse", defaultMaterial.diffuse);
    standardShader.setVec3("pass_material.specular", defaultMaterial.specular);
    standardShader.setFloat("pass_material.shininess", defaultMaterial.shininess);
}

void GFRender::spherePbrTextureLoad()
{
    spherePbrTexture.albedo = PbrMaterialWithTexture::loadTexture("../Texture/rustediron/albedo.png");
    spherePbrTexture.normal = PbrMaterialWithTexture::loadTexture("../Texture/rustediron/normal.png");
    spherePbrTexture.metallic = PbrMaterialWithTexture::loadTexture("../Texture/rustediron/metallic.png");
    spherePbrTexture.roughness = PbrMaterialWithTexture::loadTexture("../Texture/rustediron/roughness.png");
    spherePbrTexture.ao = PbrMaterialWithTexture::loadTexture("../Texture/rustediron/ao.png");
}

void GFRender::pbrSetting()
{
    pbrMaterial.albedo = glm::vec3(0.5f, 0.5f, 0.5f);
    pbrMaterial.ao = 1.0f;
    pbrMaterial.metallic = 0.8f;
    pbrMaterial.roughness = 0.2f;

    for (int i = 0; i < 6; i++)
    {
        pbrLight[i].actived = true;
        pbrLight[i].lightColor[0] = 300.0f;
        pbrLight[i].lightColor[1] = 300.0f;
        pbrLight[i].lightColor[2] = 300.0f;
    }

    pbrLight[0].Position[0] = -3.0f;
    pbrLight[0].Position[1] = 0.0f;
    pbrLight[0].Position[2] = 0.0f;

    pbrLight[1].Position[0] = 3.0f;
    pbrLight[1].Position[1] = 0.0f;
    pbrLight[1].Position[2] = 0.0f;

    pbrLight[2].Position[0] = 0.0f;
    pbrLight[2].Position[1] = 3.0f;
    pbrLight[2].Position[2] = 0.0f;

    pbrLight[3].Position[0] = 0.0f;
    pbrLight[3].Position[1] = -3.0f;
    pbrLight[3].Position[2] = 0.0f;

    pbrLight[4].Position[0] = 0.0f;
    pbrLight[4].Position[1] = 0.0f;
    pbrLight[4].Position[2] = 3.0f;

    pbrLight[5].Position[0] = 0.0f;
    pbrLight[5].Position[1] = 0.0f;
    pbrLight[5].Position[2] = -3.0f;
}

void GFRender::pbrShaderSet(glm::mat4 model, glm::mat4 view, glm::mat4 projection, glm::vec3 viewPos, bool is_textured)
{
    pbrShader.use();
    pbrShader.setMat4("model", model);
    pbrShader.setMat4("view", view);
    pbrShader.setMat4("projection", projection);
    pbrShader.setVec3("cam_pos", viewPos);
    pbrShader.setVec3("pbr_mc.albedo", pbrMaterial.albedo[0], pbrMaterial.albedo[1], pbrMaterial.albedo[2]);
    pbrShader.setFloat("pbr_mc.metallic", pbrMaterial.metallic);
    pbrShader.setFloat("pbr_mc.roughness", pbrMaterial.roughness);
    pbrShader.setFloat("pbr_mc.ao", pbrMaterial.ao);

    if (is_pbr_marry)
    {
        pbrShader.setBool("is_pbr_for_marry", is_pbr_marry);
        is_textured = false;
    }

    pbrShader.setBool("is_pbr_textured", is_textured);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, spherePbrTexture.albedo);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, spherePbrTexture.normal);
    glActiveTexture(GL_TEXTURE2);
    glBindTexture(GL_TEXTURE_2D, spherePbrTexture.metallic);
    glActiveTexture(GL_TEXTURE3);
    glBindTexture(GL_TEXTURE_2D, spherePbrTexture.roughness);
    glActiveTexture(GL_TEXTURE4);
    glBindTexture(GL_TEXTURE_2D, spherePbrTexture.ao);
    glActiveTexture(GL_TEXTURE5);
    glBindTexture(GL_TEXTURE_2D, marryTexture);


    for (int i = 0; i < 6; i++)
    {
        pbrShader.setBool("pbr_lip[" + std::to_string(i) + "].actived", pbrLight[i].actived);
        pbrShader.setVec3("pbr_lip[" + std::to_string(i) + "].light_pos", pbrLight[i].Position[0], pbrLight[i].Position[1], pbrLight[i].Position[2]);
        pbrShader.setVec3("pbr_lip[" + std::to_string(i) + "].light_color", pbrLight[i].lightColor[0], pbrLight[i].lightColor[1], pbrLight[i].lightColor[2]);
    }
}

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    glViewport(0, 0, width, height);
}
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)   
{
    if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_RIGHT) == GLFW_PRESS)
    {
        float xpos = static_cast<float>(xposIn);
        float ypos = static_cast<float>(yposIn);
        if (firstMouse)
        {
            lastX = xpos;
            lastY = ypos;
            firstMouse = false;
        }
        float xoffset = xpos - lastX;
        float yoffset = lastY - ypos; // reversed since y-coordinates go from bottom to top
        lastX = xpos;
        lastY = ypos;
        camera.ProcessMouseMovement(xoffset, yoffset);
    }
}
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    camera.ProcessMouseScroll(static_cast<float>(yoffset));
}
void processInput(GLFWwindow* window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(UP, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(DOWN, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime);
}
void timing()
{
    float currentFrame = static_cast<float>(glfwGetTime());
    deltaTime = currentFrame - lastFrame;
    lastFrame = currentFrame;
}
