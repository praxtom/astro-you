import { useState, useCallback, type ChangeEvent } from "react";
import type { FieldConfig, FieldState } from "./formRules";

export function useForm(config: Record<string, FieldConfig>) {
  const getInitialState = useCallback((): Record<string, FieldState> => {
    const state: Record<string, FieldState> = {};
    for (const key in config) {
      state[key] = {
        value: config[key].initialValue,
        error: null,
        touched: false,
        dirty: false,
      };
    }
    return state;
  }, [config]);

  const [formState, setFormState] =
    useState<Record<string, FieldState>>(getInitialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (fieldName: string, value: string): string | null => {
      const fieldConfig = config[fieldName];
      if (!fieldConfig.rules) return null;

      for (const rule of fieldConfig.rules) {
        if (!rule.validate(value)) {
          return rule.message;
        }
      }
      return null;
    },
    [config]
  );

  const handleChange = useCallback(
    (fieldName: string) =>
      (
        e: ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
      ) => {
        const value = e.target.value;
        const fieldConfig = config[fieldName];

        setFormState((prev) => {
          const error =
            fieldConfig.validateOnChange !== false
              ? validateField(fieldName, value)
              : prev[fieldName].error;

          return {
            ...prev,
            [fieldName]: {
              value,
              error: prev[fieldName].touched ? error : null,
              touched: prev[fieldName].touched,
              dirty: true,
            },
          };
        });
      },
    [config, validateField]
  );

  const handleBlur = useCallback(
    (fieldName: string) => () => {
      const fieldConfig = config[fieldName];

      setFormState((prev) => {
        const error =
          fieldConfig.validateOnBlur !== false
            ? validateField(fieldName, prev[fieldName].value)
            : prev[fieldName].error;

        return {
          ...prev,
          [fieldName]: {
            ...prev[fieldName],
            error,
            touched: true,
          },
        };
      });
    },
    [config, validateField]
  );

  const setFieldValue = useCallback((fieldName: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value,
        dirty: true,
      },
    }));
  }, []);

  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newState = { ...formState };

    for (const key in config) {
      const error = validateField(key, formState[key].value);
      newState[key] = {
        ...formState[key],
        error,
        touched: true,
      };
      if (error) isValid = false;
    }

    setFormState(newState);
    return isValid;
  }, [config, formState, validateField]);

  const handleSubmit = useCallback(
    (onSubmit: (data: Record<string, string>) => Promise<void> | void) =>
      async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateAll()) return;

        setIsSubmitting(true);
        try {
          const data: Record<string, string> = {};
          for (const key in formState) {
            data[key] = formState[key].value;
          }
          await onSubmit(data);
        } finally {
          setIsSubmitting(false);
        }
      },
    [formState, validateAll]
  );

  const reset = useCallback(() => {
    setFormState(getInitialState());
  }, [getInitialState]);

  const getFieldProps = useCallback(
    (fieldName: string) => ({
      value: formState[fieldName].value,
      onChange: handleChange(fieldName),
      onBlur: handleBlur(fieldName),
      "aria-invalid": !!formState[fieldName].error,
      "aria-describedby": formState[fieldName].error
        ? `${fieldName}-error`
        : undefined,
    }),
    [formState, handleChange, handleBlur]
  );

  const isValid = Object.values(formState).every((field) => !field.error);
  const isDirty = Object.values(formState).some((field) => field.dirty);

  return {
    formState,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    validateField,
    validateAll,
    reset,
    getFieldProps,
    isSubmitting,
    isValid,
    isDirty,
  };
}

export default useForm;
export { rules } from "./formRules";
export type { FieldConfig, FieldState, ValidationRule } from "./formRules";
