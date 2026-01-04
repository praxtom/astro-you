import { useState, useCallback, ChangeEvent } from "react";

type ValidationRule = {
  validate: (value: string) => boolean;
  message: string;
};

type FieldConfig = {
  initialValue: string;
  rules?: ValidationRule[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
};

type FieldState = {
  value: string;
  error: string | null;
  touched: boolean;
  dirty: boolean;
};

export const rules = {
  required: (message = "This field is required"): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),

  email: (message = "Please enter a valid email"): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => value.length <= max,
    message: message || `Must be no more than ${max} characters`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => regex.test(value),
    message,
  }),

  date: (message = "Please enter a valid date"): ValidationRule => ({
    validate: (value) => !isNaN(Date.parse(value)),
    message,
  }),

  time: (message = "Please enter a valid time"): ValidationRule => ({
    validate: (value) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value),
    message,
  }),
};

export function useForm(config: Record<string, FieldConfig>) {
  const getInitialState = (): Record<string, FieldState> => {
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
  };

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
  }, []);

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

export function FieldError({
  error,
  fieldName,
}: {
  error: string | null;
  fieldName: string;
}) {
  if (!error) return null;

  return (
    <p
      id={`${fieldName}-error`}
      role="alert"
      className="text-red-400 text-xs mt-1.5 font-sans flex items-center gap-1"
    >
      <span aria-hidden="true">⚠</span>
      {error}
    </p>
  );
}

export default useForm;
