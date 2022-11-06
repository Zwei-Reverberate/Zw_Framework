#version 430 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoords;

out vec2 tex_coords;
out vec3 world_pos;
out vec3 normal;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

void main()
{
    tex_coords = aTexCoords;
    world_pos = vec3(model * vec4(aPos, 1.0));
    normal = mat3(model) * aNormal;   

    gl_Position =  projection * view * vec4(world_pos, 1.0);
}