import { useEffect, useCallback } from 'react';
import { soundManager } from './SoundManager';

// Sound effect names
export const SOUNDS = {
  // UI sounds
  BUTTON_CLICK: 'button-click',
  TOGGLE_ON: 'toggle-on',
  TOGGLE_OFF: 'toggle-off',
  SLIDER_CHANGE: 'slider-change',
  ZOOM_IN: 'zoom-in',
  ZOOM_OUT: 'zoom-out',
  
  // Simulation sounds
  ENTITY_SPAWN: 'entity-spawn',
  ENTITY_DEATH: 'entity-death',
  REPRODUCTION: 'reproduction',
  MUTATION: 'mutation',
  
  // Ambient/Music
  SPACE_AMBIENT: 'space-ambient',
  PLANET_AMBIENT: 'planet-ambient',
} as const;

export type SoundName = typeof SOUNDS[keyof typeof SOUNDS];

interface UseSoundEffectsOptions {
  enabled?: boolean;
  effectsVolume?: number;
  musicVolume?: number;
}

export function useSoundEffects(options: UseSoundEffectsOptions = {}) {
  const { 
    enabled = true, 
    effectsVolume = 0.7, 
    musicVolume = 0.5 
  } = options;
  
  useEffect(() => {
    // Initialize sound manager
    soundManager.initialize();
    
    // Load default sounds (URLs would need to be provided)
    // These are placeholder paths - actual sound files would need to be added
    const loadSounds = async () => {
      // UI sounds
      // await soundManager.loadSound(SOUNDS.BUTTON_CLICK, '/sounds/button-click.mp3');
      // await soundManager.loadSound(SOUNDS.TOGGLE_ON, '/sounds/toggle-on.mp3');
      // await soundManager.loadSound(SOUNDS.TOGGLE_OFF, '/sounds/toggle-off.mp3');
      // await soundManager.loadSound(SOUNDS.SLIDER_CHANGE, '/sounds/slider-change.mp3');
      // await soundManager.loadSound(SOUNDS.ZOOM_IN, '/sounds/zoom-in.mp3');
      // await soundManager.loadSound(SOUNDS.ZOOM_OUT, '/sounds/zoom-out.mp3');
      
      // Simulation sounds
      // await soundManager.loadSound(SOUNDS.ENTITY_SPAWN, '/sounds/entity-spawn.mp3');
      // await soundManager.loadSound(SOUNDS.ENTITY_DEATH, '/sounds/entity-death.mp3');
      // await soundManager.loadSound(SOUNDS.REPRODUCTION, '/sounds/reproduction.mp3');
      // await soundManager.loadSound(SOUNDS.MUTATION, '/sounds/mutation.mp3');
      
      // Ambient music
      // await soundManager.loadSound(SOUNDS.SPACE_AMBIENT, '/sounds/space-ambient.mp3');
      // await soundManager.loadSound(SOUNDS.PLANET_AMBIENT, '/sounds/planet-ambient.mp3');
    };
    
    loadSounds();
  }, []);
  
  useEffect(() => {
    soundManager.setEnabled(enabled);
  }, [enabled]);
  
  useEffect(() => {
    soundManager.setEffectsVolume(effectsVolume);
  }, [effectsVolume]);
  
  useEffect(() => {
    soundManager.setMusicVolume(musicVolume);
  }, [musicVolume]);
  
  const playSound = useCallback((sound: SoundName, volume?: number) => {
    soundManager.playEffect(sound, volume);
  }, []);
  
  const playMusic = useCallback((sound: SoundName, loop = true) => {
    soundManager.playMusic(sound, loop);
  }, []);
  
  const stopMusic = useCallback(() => {
    soundManager.stopMusic();
  }, []);
  
  return {
    playSound,
    playMusic,
    stopMusic,
  };
}