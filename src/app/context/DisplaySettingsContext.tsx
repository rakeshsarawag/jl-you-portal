import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type FontScale = 'sm' | 'md' | 'lg';
type Density = 'compact' | 'comfortable' | 'spacious';

interface DisplaySettings {
  fontScale: FontScale;
  density: Density;
  setFontScale: (scale: FontScale) => void;
  setDensity: (density: Density) => void;
}

const DisplaySettingsContext = createContext<DisplaySettings>({
  fontScale: 'md',
  density: 'comfortable',
  setFontScale: () => {},
  setDensity: () => {},
});

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(
    () => (localStorage.getItem('app_font_scale') as FontScale) || 'md'
  );
  const [density, setDensityState] = useState<Density>(
    () => (localStorage.getItem('app_density') as Density) || 'comfortable'
  );

  function setFontScale(scale: FontScale) {
    setFontScaleState(scale);
    localStorage.setItem('app_font_scale', scale);
    document.documentElement.classList.remove('font-scale-sm', 'font-scale-md', 'font-scale-lg');
    document.documentElement.classList.add(`font-scale-${scale}`);
  }

  function setDensity(d: Density) {
    setDensityState(d);
    localStorage.setItem('app_density', d);
    document.documentElement.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
    document.documentElement.classList.add(`density-${d}`);
  }

  useEffect(() => {
    // Apply saved settings on mount
    document.documentElement.classList.add(`font-scale-${fontScale}`, `density-${density}`);
  }, []);

  return (
    <DisplaySettingsContext.Provider value={{ fontScale, density, setFontScale, setDensity }}>
      {children}
    </DisplaySettingsContext.Provider>
  );
}

export const useDisplaySettings = () => useContext(DisplaySettingsContext);
