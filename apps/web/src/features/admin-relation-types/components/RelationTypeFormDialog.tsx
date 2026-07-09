"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { relationTypeNameSchema } from "@iib/domain";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card, Heading, Input } from "@/components/ui";
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
      <Card className="w-full max-w-md bg-surface-raised p-6">
        <Heading level={2} className="mb-4">{FORM_DIALOG_TITLES[mode]}</Heading>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="relation-type-name" className="text-sm font-medium">
              {NAME_FIELD_LABEL}
            </label>
            <Input
              id="relation-type-name"
              type="text"
              placeholder={NAME_FIELD_PLACEHOLDER}
              invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name && (
              <p role="alert" className="text-xs text-danger">
                {errors.name.message}
              </p>
            )}
            {!errors.name && serverErrorMessage && (
              <p role="alert" className="text-xs text-danger">
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
              <p className="text-xs text-fg-muted">{DIRECTION_FIELD_HELP_TEXT}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
              {CANCEL_BUTTON_LABEL}
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {SUBMIT_BUTTON_LABELS[mode]}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
