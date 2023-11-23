import { getColor, kernelGenerator } from "@/script/utils/dom";
import { constrain, constrainLerp } from "@/script/utils/math";
import type { IKernelFunctionThis } from "@/script/utils/types";
import * as color from "@thi.ng/color";

export default function execute() {
  let isActive = false;
  let isDrawing = 0;
  const DIFFUSION_RATE = [1, 0.5];
  const ADDER = 0.0545;
  const REMOVER = 0.062;
  const scale = 1;

  interface IUpdateConstants {
    ADDER: number;
    REMOVER: number;
    DIFFUSION_RATE: number[];
  }
  interface IDrawConstants {
    BASE_COLOR: [number, number, number];
    CONC_COLOR: [number, number, number];
  }

  function init(this: IKernelFunctionThis): [number, number] {
    if (
      Math.pow(Math.abs(this.thread.x - this.output.x / 2), 2) +
      Math.pow(Math.abs(this.thread.y - this.output.y / 2), 2) <
      Math.pow(10 / scale, 2)
    )
      return [1, 1];
    return [1, 0];
  }
  function update(
    this: IKernelFunctionThis<IUpdateConstants>,
    grid: [number, number][][],
    dt: number,
  ): [number, number] {
    const v = grid[this.thread.y][this.thread.x];
    const rxn = v[0] * v[1] * v[1];
    const reaction = [
      -rxn + this.constants.ADDER * (1.0 - v[0]),
      +rxn - (this.constants.ADDER + this.constants.REMOVER) * v[1],
    ];
    const div_grad = [0, 0];
    if (
      this.thread.x != 0 &&
      this.thread.y != 0 &&
      this.thread.x + 1 != this.output.x &&
      this.thread.y + 1 != this.output.y
    ) {
      constrain(0, 0, dt); //TODO
      const cl = grid[this.thread.y][this.thread.x - 1];
      const cr = grid[this.thread.y][this.thread.x + 1];
      const uc = grid[this.thread.y - 1][this.thread.x];
      const dc = grid[this.thread.y + 1][this.thread.x];
      const ul = grid[this.thread.y - 1][this.thread.x - 1];
      const ur = grid[this.thread.y - 1][this.thread.x + 1];
      const dl = grid[this.thread.y + 1][this.thread.x - 1];
      const dr = grid[this.thread.y + 1][this.thread.x + 1];
      div_grad[0] +=
        v[0] * -1.0 +
        cl[0] * 0.2 +
        cr[0] * 0.2 +
        uc[0] * 0.2 +
        dc[0] * 0.2 +
        ul[0] * 0.05 +
        dl[0] * 0.05 +
        ur[0] * 0.05 +
        dr[0] * 0.05;
      div_grad[1] +=
        v[1] * -1.0 +
        cl[1] * 0.2 +
        cr[1] * 0.2 +
        uc[1] * 0.2 +
        dc[1] * 0.2 +
        ul[1] * 0.05 +
        dl[1] * 0.05 +
        ur[1] * 0.05 +
        dr[1] * 0.05;
    }
    const delta = [
      this.constants.DIFFUSION_RATE[0] * div_grad[0] + reaction[0],
      this.constants.DIFFUSION_RATE[1] * div_grad[1] + reaction[1],
    ];
    return [
      constrain(v[0] + dt * delta[0], 0, 1),
      constrain(v[1] + dt * delta[1], 0, 1),
    ];
  }
  function draw(
    this: IKernelFunctionThis<IDrawConstants>,
    grid: [number, number][][],
  ) {
    const v = grid[this.thread.y][this.thread.x];
    this.color(
      constrainLerp(
        v[0] - v[1],
        this.constants.CONC_COLOR[0],
        this.constants.BASE_COLOR[0],
      ),
      constrainLerp(
        v[0] - v[1],
        this.constants.CONC_COLOR[1],
        this.constants.BASE_COLOR[1],
      ),
      constrainLerp(
        v[0] - v[1],
        this.constants.CONC_COLOR[2],
        this.constants.BASE_COLOR[2],
      ),
      1,
    );
  }

  return {
    start: (canvas: HTMLCanvasElement) => {
      isActive = true;
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      const buffer = ctx.createImageData(
        canvas.width / scale,
        canvas.height / scale,
      );
      const init_kernel = kernelGenerator(init, {}, buffer);
      const update_kernel = kernelGenerator(
        update,
        {
          ADDER,
          REMOVER,
          DIFFUSION_RATE,
        },
        buffer,
      );
      const draw_kernel = kernelGenerator(
        draw,
        {
          BASE_COLOR: color.rgb(getColor("--md-sys-color-surface", "#000")).xyz,
          CONC_COLOR: color.rgb(getColor("--md-sys-color-on-surface", "#FFF")).xyz,
        },
        buffer,
      );
      let grid = (() => {
        const step = init_kernel();
        let res;
        do res = step.next();
        while (!res.done);
        return res.value;
      })();

      isDrawing = 1;
      requestAnimationFrame(function draw() {
        if (!isActive) return;
        if (isDrawing >= 1) {
          new Promise<ImageBitmap>((resolve) => {
            const step = draw_kernel(grid);
            let res;
            do res = step.next();
            while (!res.done);
            createImageBitmap(buffer).then((bmp) => resolve(bmp));
            return res.value;
          }).then((bmp) =>
            ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height),
          );
          isDrawing = 0;
        }
        grid = (() => {
          const step = update_kernel(grid, 1);
          let res;
          do res = step.next();
          while (!res.done);
          return res.value;
        })();
        isDrawing += 1 / 100;
        requestAnimationFrame(draw);
      });
    },
    stop: () => {
      isActive = false;
    },
  };
}
