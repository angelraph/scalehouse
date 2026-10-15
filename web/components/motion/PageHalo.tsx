import { DotField } from "./DotField";

/** The hero's flowing dot world, smaller, behind the title of an inner page. */
export function PageHalo() {
  return (
    <div className="pointer-events-none absolute top-[-1.5rem] left-1/2 -z-10 h-[calc(100%+4rem)] w-screen -translate-x-1/2" aria-hidden>
      <DotField origin={[0.85, 0.35]} />
      <div className="hero-fade absolute inset-0" />
    </div>
  );
}
