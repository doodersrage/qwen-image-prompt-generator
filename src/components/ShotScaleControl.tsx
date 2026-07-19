"use client";

import {
  FANTASY_SHOT_SCALE_OPTIONS,
  SHOT_SCALE_LABEL,
  SUBJECT_SHOT_SCALE_OPTIONS,
  type FantasyShotScale,
  type SubjectShotScale,
} from "@/lib/tool-ui-labels";
import { FieldLabel } from "@/components/ui/Field";

type ShotScaleControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ label: string; value: T }>;
  activeClassName: string;
};

function ShotScaleButtons<T extends string>({
  value,
  onChange,
  options,
  activeClassName,
}: ShotScaleControlProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
            value === option.value
              ? activeClassName
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SubjectShotScaleControl({
  value,
  onChange,
  activeClassName,
}: {
  value: SubjectShotScale;
  onChange: (value: SubjectShotScale) => void;
  activeClassName: string;
}) {
  return (
    <>
      <FieldLabel>{SHOT_SCALE_LABEL}</FieldLabel>
      <ShotScaleButtons
        value={value}
        onChange={onChange}
        options={SUBJECT_SHOT_SCALE_OPTIONS}
        activeClassName={activeClassName}
      />
    </>
  );
}

export function FantasyShotScaleControl({
  value,
  onChange,
  activeClassName,
  environmentOnly = false,
}: {
  value: FantasyShotScale;
  onChange: (value: FantasyShotScale) => void;
  activeClassName: string;
  environmentOnly?: boolean;
}) {
  const options = environmentOnly
    ? FANTASY_SHOT_SCALE_OPTIONS.filter((option) => option.value === "wide")
    : FANTASY_SHOT_SCALE_OPTIONS;

  return (
    <>
      <FieldLabel>{SHOT_SCALE_LABEL}</FieldLabel>
      <ShotScaleButtons
        value={value}
        onChange={onChange}
        options={options}
        activeClassName={activeClassName}
      />
    </>
  );
}
