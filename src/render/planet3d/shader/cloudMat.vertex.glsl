varying vec3 vN; 
varying vec3 vPosW;
void main(){ 
  vN = normalize(normalMatrix*normal); 
  vec4 w=modelMatrix*vec4(position,1.0); 
  vPosW=w.xyz; 
  gl_Position=projectionMatrix*viewMatrix*w; 
}