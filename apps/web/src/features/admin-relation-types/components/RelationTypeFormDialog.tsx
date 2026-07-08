"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { relationTypeNameSchema } from "@iib/domain";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  CANCEL_BUTTON_LABEL,
  DIRECTION_FIELD_HELP_TEXT,
  DIRECTION_FIELD_LABEL,
  DIRECTION_LABELS,
  FORM_DIALOG_TITLES,
  NAME_FIELD_LABEL,
  NAME_FIELD_PLACEHOLDER,
  SUBMIT_BUTTON_LABELS,
} from "@/features/admin-relation-types/constants";

const relationTypeFormSchema = z.object({
  name: relationTypeNameSchema,
  isDirected: z.boolean(),
});

export type RelationTypeFormValues = z.infer<typeof relationTypeFormSchema>;

export type RelationTypeFormDialogProps = {
  mode: "create" | "rename";
  target?: { id: string; name: string };
  isSubmitting: boolean;
  /** 서버 409 등 외부 오류를 이름 필드에 주입할 때 사용(Container가 설정, M12 QA-5). */
  serverErrorMessage?: string | null;
  onSubmit: (values: RelationTypeFormValues) => void;
  onCancel: () => void;
};

/**
 * 순수 Presenter — 관계 종류 추가/이름 변경 공용 폼 다이얼로그(plan M12).
 * create 모드는 이름+방향성(기본 유향, BR-4), rename 모드는 이름만 노출한다
 * (방향성은 생성 후 변경 불가).
 */
export function RelationTypeFormDialog({
  mode,
  target,
  isSubmitting,
  serverErrorMessage,
  onSubmit,
  onCancel,
}: RelationTypeFormDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RelationTypeFormValues>({
    resolver: zodResolver(relationTypeFormSchema),
    defaultValues: {
      name: mode === "rename" ? (target?.name ?? "") : "",
      isDirected: true,
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={FORM_DIALOG_TITLES[mode]}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{FORM_DIALOG_TITLES[mode]}</h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="relation-type-name" className="text-sm font-medium">
              {NAME_FIELD_LABEL}
            </label>
            <input
              id="relation-type-name"
              type="text"
              placeholder={NAME_FIELD_PLACEHOLDER}
              className="rounded border px-3 py-2 text-sm"
              {...register("name")}
            />
            {errors.name && (
              <p role="alert" className="text-xs text-red-600">
                {errors.name.message}
              </p>
            )}
            {!errors.name && serverErrorMessage && (
              <p role="alert" className="text-xs text-red-600">
                {serverErrorMessage}
              </p>
            )}
          </div>

          {mode === "create" && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{DIRECTION_FIELD_LABEL}</span>
              <Controller
                name="isDirected"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={field.value === true}
                        onChange={() => field.onChange(true)}
                        onBlur={field.onBlur}
                      />
                      {DIRECTION_LABELS.directed}
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={field.value === false}
                        onChange={() => field.onChange(false)}
                        onBlur={field.onBlur}
                      />
                      {DIRECTION_LABELS.undirected}
                    </label>
                  </div>
                )}
              />
              <p className="text-xs text-gray-500">{DIRECTION_FIELD_HELP_TEXT}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {CANCEL_BUTTON_LABEL}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {SUBMIT_BUTTON_LABELS[mode]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
