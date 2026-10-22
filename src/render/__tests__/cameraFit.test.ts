import { describe, expect, it } from "vitest";
import { CITY_WORLD, fitCityCamera } from "../cameraFit";
import { BUILDINGS } from "../../game/content";
import { getBuildingPosition } from "../cityLayout";

describe("complete city contain-fit", () => {
  it.each([[1920,1080],[1920,916],[1280,720],[870,668],[960,540],[844,390],[667,375],[390,844],[375,667],[320,568]])("fits every city edge above the tray in %dx%d", (width,height) => {
    const area = {left:12,right:width-12,top:112,bottom:Math.max(132,height-340)};
    const fit=fitCityCamera(width,height,area);
    for (const x of [CITY_WORLD.left,CITY_WORLD.right]) for (const y of [CITY_WORLD.bottom,CITY_WORLD.top]) {
      const px=width/2+(x-fit.x)*width/fit.width;
      const py=height/2-(y-fit.y)*height/fit.height;
      expect(px).toBeGreaterThanOrEqual(area.left-1e-6);
      expect(px).toBeLessThanOrEqual(area.right+1e-6);
      expect(py).toBeGreaterThanOrEqual(area.top-1e-6);
      expect(py).toBeLessThanOrEqual(area.bottom+1e-6);
    }
  });
  it("includes outer plots and their painted roofs rather than a cropped central focus", () => {
    for (const id of Object.keys(BUILDINGS)) {
      const p=getBuildingPosition(id);
      expect(p.x-7).toBeGreaterThan(CITY_WORLD.left);
      expect(p.x+7).toBeLessThan(CITY_WORLD.right);
      expect(p.y).toBeGreaterThan(CITY_WORLD.bottom);
      expect(p.y+8).toBeLessThan(CITY_WORLD.top);
    }
  });
});
