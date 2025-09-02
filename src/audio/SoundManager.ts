export class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private musicGainNode: GainNode | null = null;
  private effectsGainNode: GainNode | null = null;
  private currentMusic: AudioBufferSourceNode | null = null;
  private enabled: boolean = true;
  private musicVolume: number = 0.5;
  private effectsVolume: number = 0.7;
  
  private constructor() {
    // Singleton
  }
  
  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }
  
  async initialize(): Promise<void> {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain nodes for volume control
      this.musicGainNode = this.audioContext.createGain();
      this.musicGainNode.gain.value = this.musicVolume;
      this.musicGainNode.connect(this.audioContext.destination);
      
      this.effectsGainNode = this.audioContext.createGain();
      this.effectsGainNode.gain.value = this.effectsVolume;
      this.effectsGainNode.connect(this.audioContext.destination);
      
      // Resume context on user interaction (required for some browsers)
      const resumeAudio = () => {
        if (this.audioContext?.state === 'suspended') {
          this.audioContext.resume();
        }
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('keydown', resumeAudio);
      };
      
      document.addEventListener('click', resumeAudio);
      document.addEventListener('keydown', resumeAudio);
      
    } catch (error) {
      console.warn('Failed to initialize audio context:', error);
      this.enabled = false;
    }
  }
  
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.audioContext || this.sounds.has(name)) return;
    
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds.set(name, audioBuffer);
    } catch (error) {
      console.warn(`Failed to load sound ${name}:`, error);
    }
  }
  
  playEffect(name: string, volume: number = 1.0): void {
    if (!this.enabled || !this.audioContext || !this.effectsGainNode) return;
    
    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`Sound effect "${name}" not loaded`);
      return;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Create a gain node for this specific sound
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(this.effectsGainNode);
    
    source.start();
  }
  
  async playMusic(name: string, loop: boolean = true): Promise<void> {
    if (!this.enabled || !this.audioContext || !this.musicGainNode) return;
    
    // Stop current music if playing
    this.stopMusic();
    
    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`Music "${name}" not loaded`);
      return;
    }
    
    this.currentMusic = this.audioContext.createBufferSource();
    this.currentMusic.buffer = buffer;
    this.currentMusic.loop = loop;
    
    this.currentMusic.connect(this.musicGainNode);
    this.currentMusic.start();
  }
  
  stopMusic(): void {
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch (e) {
        // Already stopped
      }
      this.currentMusic = null;
    }
  }
  
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGainNode) {
      this.musicGainNode.gain.value = this.musicVolume;
    }
  }
  
  setEffectsVolume(volume: number): void {
    this.effectsVolume = Math.max(0, Math.min(1, volume));
    if (this.effectsGainNode) {
      this.effectsGainNode.gain.value = this.effectsVolume;
    }
  }
  
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopMusic();
    }
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance();