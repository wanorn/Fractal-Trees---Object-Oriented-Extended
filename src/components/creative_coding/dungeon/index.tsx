import { previewContainer, sketch } from "@/styles/creative_coding.module.css";
import React, { useEffect, useRef } from "react";

export default React.lazy(async () => {
  const main =
    typeof window !== "undefined"
      ? (await import("@/script/creative_coding/dungeon")).default
      : () => null;
  return {
    default: function Component() {
      const canvas = useRef<HTMLCanvasElement>(null);
      const exec = main();
      useEffect(() => {
        exec?.start(canvas.current!);
      }, []);
      useEffect(
        () => () => {
          exec?.stop();
        },
        [],
      );
      return (
        <div className={previewContainer}>
          <canvas
            width="500"
            height="500"
            className={sketch}
            ref={canvas}
          ></canvas>
        </div>
      );
    },
  };
});
