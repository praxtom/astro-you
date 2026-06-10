export type ValidationRule = {
  validate: (value: string) => boolean;
  message: string;
};

export type FieldConfig = {
  initialValue: string;
  rules?: ValidationRule[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
};

export type FieldState = {
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
