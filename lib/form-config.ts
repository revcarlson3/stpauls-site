export const formFieldTypes = [
  "text", "email", "phone", "textarea", "select", "radio", "checkbox", "date",
  "file", "password", "masked", "color", "chained-select", "ranking", "custom-html",
  "terms", "section-break", "button", "name", "address"
] as const;

export type FormFieldType = typeof formFieldTypes[number];
export type FormOption = { value: string; label: string; photo?: string };
export type FormField = {
  id: string;
  type: FormFieldType;
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: FormOption[];
  settings?: Record<string, unknown>;
};
export type FormCondition = { field: string; operator: "equals" | "not-equals"; value: string };
export type FormConditionGroup = FormCondition[];
export type FormFieldGroup = { id: string; label: string; description: string; fields: Omit<FormField, "id">[] };
export type FormStyle = "modern-bold" | "modern-light" | "classic" | "bootstrap" | "theme" | "custom";
export type FormStyleSettings = {
  accentColor: string;
  textColor: string;
  surfaceColor: string;
  borderColor: string;
  radius: "sharp" | "soft" | "round";
  density: "compact" | "comfortable" | "spacious";
  labelWeight: "normal" | "semibold" | "bold";
};
export type FormExportSettings = {
  includeMetadata: boolean;
  includeHiddenFields: boolean;
  fieldOrder: string[];
  csvDateFormat: "iso" | "local";
  pdfTitle: string;
  pdfAccentColor: string;
};
export type FormStep = { id: string; title: string; description?: string; fields: FormField[] };
export type FormDefinition = {
  version: 1;
  steps: FormStep[];
  style: FormStyle;
  styleSettings: FormStyleSettings;
  exportSettings: FormExportSettings;
  confirmationMode: "inline" | "redirect";
  confirmationTitle: string;
  confirmationMessage: string;
  confirmationRedirectUrl: string;
  resetOnSubmit: boolean;
  failureMessage: string;
  submitLabel: string;
};

const labels: Record<FormFieldType, string> = {
  text: "Text", email: "Email", phone: "Phone", textarea: "Long text", select: "Select",
  radio: "Radio choices", checkbox: "Checkbox", date: "Date / Time", file: "File", password: "Password", masked: "Masked input",
  color: "Color", "chained-select": "Chained select", ranking: "Ranking", "custom-html": "Custom HTML",
  terms: "Terms agreement", "section-break": "Section break", button: "Button", name: "Name group", address: "Address group"
};

export const formFieldGroups: FormFieldGroup[] = [
  {
    id: "name",
    label: "Name",
    description: "First, middle, and last name fields.",
    fields: [
      { type: "text", name: "first_name", label: "First name", required: true },
      { type: "text", name: "middle_name", label: "Middle name" },
      { type: "text", name: "last_name", label: "Last name", required: true }
    ]
  },
  {
    id: "address",
    label: "Address",
    description: "Mailing address with a pre-filled US state selector.",
    fields: [
      { type: "text", name: "address_line_1", label: "Address Line 1", required: true },
      { type: "text", name: "address_line_2", label: "Address line 2" },
      { type: "text", name: "city", label: "City", required: true },
      { type: "select", name: "state", label: "State", required: true, options: usStateOptions() },
      { type: "text", name: "postal_code", label: "ZIP code", required: true },
      { type: "select", name: "country", label: "Country", required: true, options: [] }
    ]
  }
];

export function usStateOptions() {
  return [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"],
  ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]
  ].map(([value, label]) => ({ value, label }));
}

const countryCodes = "US AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");
export function countryOptions() {
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  return countryCodes.map((value) => ({ value, label: displayNames.of(value) ?? value }));
}

export type GroupFieldSetting = { enabled: boolean; label: string; labelPlacement: string; defaultValue: string; placeholder: string; helpMessage: string; required: boolean };

export function defaultGroupSettings(type: "name" | "address") {
  const names = type === "name"
    ? [["first_name", "First name"], ["middle_name", "Middle name"], ["last_name", "Last name"]]
    : [["address_line_1", "Address Line 1"], ["address_line_2", "Address Line 2"], ["city", "City"], ["state", "State"], ["postal_code", "Zip Code"], ["country", "Country"]];
  return {
    columnSpan: 12,
    fields: Object.fromEntries(names.map(([name, label]) => [name, { enabled: true, label, labelPlacement: "top", defaultValue: "", placeholder: "", helpMessage: "", required: ["first_name", "last_name", "address_line_1", "city", "state", "postal_code", "country"].includes(name) }])),
    order: names.map(([name]) => name),
    autocompleteProvider: type === "address" ? "none" : undefined,
    containerClass: "",
    nameAttribute: "",
    elementClass: "",
    conditional: false
  };
}

export function formFieldTypeLabel(type: FormFieldType) {
  return labels[type] ?? "Field";
}

function publicConditionSettings(settings?: Record<string, unknown>) {
  const conditions = Array.isArray(settings?.conditions)
    ? settings.conditions.filter((condition): condition is FormCondition => Boolean(condition && typeof condition === "object" && !Array.isArray(condition) && typeof (condition as { field?: unknown }).field === "string" && ((condition as { operator?: unknown }).operator === "equals" || (condition as { operator?: unknown }).operator === "not-equals") && typeof (condition as { value?: unknown }).value === "string")).slice(0, 50)
    : [];
  const conditionGroups = Array.isArray(settings?.conditionGroups)
    ? settings.conditionGroups.map((group) => Array.isArray(group) ? group.filter((condition): condition is FormCondition => Boolean(condition && typeof condition === "object" && !Array.isArray(condition) && typeof (condition as { field?: unknown }).field === "string" && ((condition as { operator?: unknown }).operator === "equals" || (condition as { operator?: unknown }).operator === "not-equals") && typeof (condition as { value?: unknown }).value === "string")).slice(0, 50) : []).filter((group) => group.length).slice(0, 50)
    : [];
  return {
    conditionLogic: settings?.conditionLogic === "all" || settings?.conditionLogic === "group" ? settings.conditionLogic : "any",
    conditions,
    conditionGroups
  };
}

export function formFieldConditionsMatch(field: FormField, values: Record<string, unknown>) {
  if (field.settings?.conditional !== true) return true;
  const conditions = Array.isArray(field.settings.conditions) ? field.settings.conditions.filter((condition): condition is FormCondition => Boolean(condition && typeof condition === "object" && !Array.isArray(condition) && typeof (condition as { field?: unknown }).field === "string" && ((condition as { operator?: unknown }).operator === "equals" || (condition as { operator?: unknown }).operator === "not-equals") && typeof (condition as { value?: unknown }).value === "string")) : [];
  if (!conditions.length) return true;
  const matches = conditions.map((condition) => {
    const current = values[condition.field];
    const candidates = Array.isArray(current) ? current : current && typeof current === "object" ? Object.values(current as Record<string, unknown>) : [current];
    const equal = candidates.some((candidate) => String(candidate ?? "").trim() === condition.value.trim());
    return condition.operator === "not-equals" ? !equal : equal;
  });
  if (field.settings.conditionLogic === "group") {
    const groups = Array.isArray(field.settings.conditionGroups) ? field.settings.conditionGroups.filter((group): group is FormCondition[] => Array.isArray(group) && group.length > 0) : [];
    if (!groups.length) return true;
    return groups.some((group) => group.every((condition) => {
      const current = values[condition.field];
      const candidates = Array.isArray(current) ? current : current && typeof current === "object" ? Object.values(current as Record<string, unknown>) : [current];
      const equal = candidates.some((candidate) => String(candidate ?? "").trim() === condition.value.trim());
      return condition.operator === "not-equals" ? !equal : equal;
    }));
  }
  return field.settings.conditionLogic === "all" ? matches.every(Boolean) : matches.some(Boolean);
}

export function makeFormId(prefix = "field") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function safeRedirectUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed.slice(0, 1000);
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 1000) : "";
  } catch {
    return "";
  }
}

export function defaultFormDefinition(): FormDefinition {
  return {
    version: 1,
    steps: [{ id: "step-1", title: "Step 1", fields: [] }],
    style: "theme",
    styleSettings: {
      accentColor: "#e66f51",
      textColor: "#17324d",
      surfaceColor: "#ffffff",
      borderColor: "#d6dde1",
      radius: "soft",
      density: "comfortable",
      labelWeight: "semibold"
    },
    exportSettings: {
      includeMetadata: true,
      includeHiddenFields: false,
      fieldOrder: [],
      csvDateFormat: "iso",
      pdfTitle: "",
      pdfAccentColor: "#e66f51"
    },
    confirmationMode: "inline",
    confirmationTitle: "Thank you",
    confirmationMessage: "Thanks — your response has been received.",
    confirmationRedirectUrl: "",
    resetOnSubmit: true,
    failureMessage: "We couldn't submit your response. Please correct the highlighted fields and try again.",
    submitLabel: "Submit"
  };
}

function safeOption(value: unknown, index: number): FormOption {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    const label = typeof item.label === "string" ? item.label : `Option ${index + 1}`;
    return { label: label.slice(0, 200), value: typeof item.value === "string" ? item.value.slice(0, 200) : label.slice(0, 200), photo: typeof item.photo === "string" ? item.photo.slice(0, 500000) : undefined };
  }
  const text = typeof value === "string" ? value : `Option ${index + 1}`;
  return { label: text.slice(0, 200), value: text.slice(0, 200) };
}

export function normalizeFormDefinition(value: unknown): FormDefinition {
  const fallback = defaultFormDefinition();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const source = value as Record<string, unknown>;
  const rawSteps = Array.isArray(source.steps) ? source.steps : [];
  const steps = rawSteps.flatMap((candidate, stepIndex): FormStep[] => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const rawFields = Array.isArray(item.fields) ? item.fields : [];
    const fields = rawFields.flatMap((field, fieldIndex): FormField[] => {
      if (!field || typeof field !== "object" || Array.isArray(field)) return [];
      const raw = field as Record<string, unknown>;
      const legacyButtonType = ["submit", "cancel", "next", "previous"].includes(String(raw.type)) ? String(raw.type) : undefined;
      const type = formFieldTypes.includes(raw.type as FormFieldType) ? raw.type as FormFieldType : legacyButtonType ? "button" : "text";
      const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 200) : formFieldTypeLabel(type);
      const name = typeof raw.name === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(raw.name) ? raw.name : `field_${stepIndex + 1}_${fieldIndex + 1}`;
      const options = Array.isArray(raw.options) ? raw.options.slice(0, 100).map(safeOption) : undefined;
      const settings = raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings) ? raw.settings as Record<string, unknown> : undefined;
      return [{ id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 100) : makeFormId("field"), type, name, label, description: typeof raw.description === "string" ? raw.description.slice(0, 1000) : undefined, placeholder: typeof raw.placeholder === "string" ? raw.placeholder.slice(0, 300) : undefined, required: raw.required === true, options, settings: legacyButtonType ? { ...settings, buttonType: legacyButtonType } : settings }];
    });
    return [{ id: typeof item.id === "string" && item.id ? item.id : makeFormId("step"), title: typeof item.title === "string" && item.title.trim() ? item.title.trim().slice(0, 200) : `Step ${stepIndex + 1}`, description: typeof item.description === "string" ? item.description.slice(0, 1000) : undefined, fields }];
  });
  return {
    version: 1,
    steps: steps.length ? steps : fallback.steps,
    style: ["modern-bold", "modern-light", "classic", "bootstrap", "theme", "custom"].includes(source.style as string) ? source.style as FormStyle : fallback.style,
    styleSettings: {
      ...fallback.styleSettings,
      ...(source.styleSettings && typeof source.styleSettings === "object" && !Array.isArray(source.styleSettings) ? source.styleSettings as Record<string, unknown> : {}),
      radius: ["sharp", "soft", "round"].includes(String((source.styleSettings as Record<string, unknown> | undefined)?.radius)) ? (source.styleSettings as Record<string, unknown>).radius as FormStyleSettings["radius"] : fallback.styleSettings.radius,
      density: ["compact", "comfortable", "spacious"].includes(String((source.styleSettings as Record<string, unknown> | undefined)?.density)) ? (source.styleSettings as Record<string, unknown>).density as FormStyleSettings["density"] : fallback.styleSettings.density,
      labelWeight: ["normal", "semibold", "bold"].includes(String((source.styleSettings as Record<string, unknown> | undefined)?.labelWeight)) ? (source.styleSettings as Record<string, unknown>).labelWeight as FormStyleSettings["labelWeight"] : fallback.styleSettings.labelWeight
    },
    exportSettings: {
      ...fallback.exportSettings,
      ...(source.exportSettings && typeof source.exportSettings === "object" && !Array.isArray(source.exportSettings) ? source.exportSettings as Record<string, unknown> : {}),
      includeMetadata: (source.exportSettings as Record<string, unknown> | undefined)?.includeMetadata !== false,
      includeHiddenFields: (source.exportSettings as Record<string, unknown> | undefined)?.includeHiddenFields === true,
      fieldOrder: Array.isArray((source.exportSettings as Record<string, unknown> | undefined)?.fieldOrder) ? ((source.exportSettings as Record<string, unknown>).fieldOrder as unknown[]).filter((item): item is string => typeof item === "string").slice(0, 500) : [],
      csvDateFormat: (source.exportSettings as Record<string, unknown> | undefined)?.csvDateFormat === "local" ? "local" : "iso",
      pdfTitle: typeof (source.exportSettings as Record<string, unknown> | undefined)?.pdfTitle === "string" ? ((source.exportSettings as Record<string, unknown>).pdfTitle as string).slice(0, 200) : fallback.exportSettings.pdfTitle,
      pdfAccentColor: typeof (source.exportSettings as Record<string, unknown> | undefined)?.pdfAccentColor === "string" && /^#[0-9a-f]{6}$/i.test((source.exportSettings as Record<string, unknown>).pdfAccentColor as string) ? (source.exportSettings as Record<string, unknown>).pdfAccentColor as string : fallback.exportSettings.pdfAccentColor
    },
    confirmationMode: source.confirmationMode === "redirect" ? "redirect" : "inline",
    confirmationTitle: typeof source.confirmationTitle === "string" ? source.confirmationTitle.slice(0, 200) : fallback.confirmationTitle,
    confirmationMessage: typeof source.confirmationMessage === "string" ? source.confirmationMessage.slice(0, 500) : typeof source.successMessage === "string" ? source.successMessage.slice(0, 500) : fallback.confirmationMessage,
    confirmationRedirectUrl: safeRedirectUrl(source.confirmationRedirectUrl),
    resetOnSubmit: source.resetOnSubmit !== false,
    failureMessage: typeof source.failureMessage === "string" && source.failureMessage.trim() ? source.failureMessage.slice(0, 500) : fallback.failureMessage,
    submitLabel: typeof source.submitLabel === "string" && source.submitLabel.trim() ? source.submitLabel.slice(0, 100) : fallback.submitLabel
  };
}

export function publicFormDefinition(value: unknown) {
  const definition = normalizeFormDefinition(value);
  return {
    version: definition.version,
    style: definition.style,
    styleSettings: definition.styleSettings,
    exportSettings: definition.exportSettings,
    steps: definition.steps.map((step) => ({
      id: step.id, title: step.title, description: step.description,
      fields: step.fields.map(({ id, type, name, label, description, placeholder, required, options, settings }) => ({
        id, type, name, label, description, placeholder, required, options,
        settings: type === "name" || type === "address" ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          fields: settings?.fields,
          order: settings?.order,
          autocompleteProvider: settings?.autocompleteProvider,
          containerClass: settings?.containerClass,
          nameAttribute: settings?.nameAttribute,
          elementClass: settings?.elementClass,
          conditional: settings?.conditional
        } : type === "button" ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          buttonText: settings?.buttonText,
          buttonType: settings?.buttonType,
          buttonStyle: settings?.buttonStyle,
          buttonSize: settings?.buttonSize,
          buttonAlignment: settings?.buttonAlignment,
          loggedInOnly: settings?.loggedInOnly,
          action: settings?.action,
          url: settings?.url,
          target: settings?.target,
          email: settings?.email,
          downloadUrl: settings?.downloadUrl,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          nameAttribute: settings?.nameAttribute,
          conditional: settings?.conditional
        } : type === "section-break" ? {
          ...publicConditionSettings(settings),
          html: settings?.html,
          layout: settings?.layout,
          columns: settings?.columns,
          columnWidths: settings?.columnWidths,
          items: settings?.items,
          columnFields: settings?.columnFields,
          elementClass: settings?.elementClass,
          conditional: settings?.conditional
        } : type === "terms" ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          labelPlacement: settings?.labelPlacement,
          showCheckbox: settings?.showCheckbox,
          includeTerms: settings?.includeTerms,
          termsHtml: settings?.termsHtml,
          includePrivacy: settings?.includePrivacy,
          privacyHtml: settings?.privacyHtml,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          helpMessage: settings?.helpMessage,
          nameAttribute: settings?.nameAttribute,
          conditional: settings?.conditional
        } : type === "chained-select" ? { ...publicConditionSettings(settings), columnSpan: settings?.columnSpan, labelPlacement: settings?.labelPlacement, defaultValue: settings?.defaultValue, levels: settings?.levels, chainRows: settings?.chainRows, sourceMode: settings?.sourceMode, remoteUrl: settings?.remoteUrl, chains: settings?.chains, containerClass: settings?.containerClass, elementClass: settings?.elementClass, helpMessage: settings?.helpMessage, nameAttribute: settings?.nameAttribute, conditional: settings?.conditional } : type === "custom-html" ? { ...publicConditionSettings(settings), html: settings?.html, containerClass: settings?.containerClass, conditional: settings?.conditional } : ["select", "radio", "checkbox"].includes(type) ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          labelPlacement: settings?.labelPlacement,
          defaultValue: settings?.defaultValue,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          helpMessage: settings?.helpMessage,
          nameAttribute: settings?.nameAttribute,
          conditional: settings?.conditional,
          allowCustomValues: settings?.allowCustomValues,
          allowOther: settings?.allowOther,
          shuffled: settings?.shuffled,
          optionGrouping: settings?.optionGrouping,
          optionGroups: settings?.optionGroups,
          dateFormat: settings?.dateFormat
        } : type === "file" ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          labelPlacement: settings?.labelPlacement,
          buttonText: settings?.buttonText,
          uploadInterface: settings?.uploadInterface,
          maxFileSize: settings?.maxFileSize,
          maxFiles: settings?.maxFiles,
          allowedFiles: settings?.allowedFiles,
          errorMessage: settings?.errorMessage,
          maxFilesErrorMessage: settings?.maxFilesErrorMessage,
          unauthorizedErrorMessage: settings?.unauthorizedErrorMessage,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          helpMessage: settings?.helpMessage,
          nameAttribute: settings?.nameAttribute,
          conditional: settings?.conditional
        } : type === "ranking" ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          labelPlacement: settings?.labelPlacement,
          defaultValue: settings?.defaultValue,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          helpMessage: settings?.helpMessage,
          nameAttribute: settings?.nameAttribute,
          conditional: settings?.conditional,
          showValues: settings?.showValues,
          photos: settings?.photos,
          shuffled: settings?.shuffled,
          showPosition: settings?.showPosition,
          showReset: settings?.showReset
        } : type === "password" || type === "masked" || type === "color" ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          labelPlacement: settings?.labelPlacement,
          defaultValue: settings?.defaultValue,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          helpMessage: settings?.helpMessage,
          nameAttribute: settings?.nameAttribute,
          conditional: settings?.conditional,
          maskType: settings?.maskType,
          customMask: settings?.customMask,
          reverseMask: settings?.reverseMask,
          clearOnMismatch: settings?.clearOnMismatch,
          mobileKeyboardType: settings?.mobileKeyboardType
        } : type === "date" ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          labelPlacement: settings?.labelPlacement,
          defaultValue: settings?.defaultValue,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          helpMessage: settings?.helpMessage,
          nameAttribute: settings?.nameAttribute,
          conditional: settings?.conditional,
          dateFormat: settings?.dateFormat
        } : ["text", "email", "phone", "textarea"].includes(type) ? {
          ...publicConditionSettings(settings),
          columnSpan: settings?.columnSpan,
          labelPlacement: settings?.labelPlacement,
          defaultValue: settings?.defaultValue,
          containerClass: settings?.containerClass,
          elementClass: settings?.elementClass,
          helpMessage: settings?.helpMessage,
          prefixLabel: settings?.prefixLabel,
          suffixLabel: settings?.suffixLabel,
          nameAttribute: settings?.nameAttribute,
          maxLength: settings?.maxLength,
          isUnique: settings?.isUnique,
          conditional: settings?.conditional,
          optionGrouping: settings?.optionGrouping,
          optionGroups: settings?.optionGroups,
          allowCustomValues: settings?.allowCustomValues,
          shuffled: settings?.shuffled,
          validateEmail: settings?.validateEmail,
          validatePhone: settings?.validatePhone,
          defaultCountry: settings?.defaultCountry,
          errorMessage: settings?.errorMessage
        } : undefined
      }))
    })),
    confirmationMode: definition.confirmationMode,
    confirmationTitle: definition.confirmationTitle,
    confirmationMessage: definition.confirmationMessage,
    confirmationRedirectUrl: definition.confirmationRedirectUrl,
    resetOnSubmit: definition.resetOnSubmit,
    failureMessage: definition.failureMessage,
    submitLabel: definition.submitLabel
  };
}

export function validateFormValues(definitionValue: unknown, input: unknown) {
  const definition = normalizeFormDefinition(definitionValue);
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const field of definition.steps.flatMap((step) => step.fields)) {
    if (!formFieldConditionsMatch(field, source)) continue;
    if (["section-break", "button", "custom-html"].includes(field.type)) continue;
    const value = source[field.name];
    if (field.type === "name" || field.type === "address") {
      const groupValue = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      const fieldSettings = field.settings?.fields && typeof field.settings.fields === "object" && !Array.isArray(field.settings.fields) ? field.settings.fields as Record<string, unknown> : {};
      const sanitized: Record<string, string> = {};
      for (const key of Array.isArray(field.settings?.order) ? field.settings.order.filter((item): item is string => typeof item === "string") : Object.keys(fieldSettings)) {
        const config = fieldSettings[key] && typeof fieldSettings[key] === "object" && !Array.isArray(fieldSettings[key]) ? fieldSettings[key] as Record<string, unknown> : {};
        const childValue = typeof groupValue[key] === "string" ? groupValue[key] : "";
        if (config.enabled !== false && config.required === true && !childValue) errors[`${field.name}.${key}`] = "This field is required.";
        if (config.enabled !== false) sanitized[key] = childValue.slice(0, 1000);
      }
      values[field.name] = sanitized;
      continue;
    }
    if (field.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0) || (field.type === "chained-select" && (!value || typeof value !== "object" || Object.values(value as Record<string, unknown>).some((item) => !item))) || (field.type === "terms" && field.settings?.showCheckbox !== false && value !== true))) errors[field.name] = "This field is required.";
    if (value !== undefined && ["text", "email", "phone", "textarea", "select", "radio", "date", "password", "masked", "color"].includes(field.type) && typeof value !== "string") errors[field.name] = "Invalid field value.";
    if (field.type === "chained-select" && value !== undefined && (!value || typeof value !== "object" || Array.isArray(value) || Object.values(value as Record<string, unknown>).some((item) => typeof item !== "string"))) errors[field.name] = "Invalid chained selection.";
    if (field.type === "email" && field.settings?.validateEmail !== false && value && (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) errors[field.name] = typeof field.settings?.errorMessage === "string" && field.settings.errorMessage ? field.settings.errorMessage : "Enter a valid email address.";
    if (field.type === "phone" && field.settings?.validatePhone !== false && value && (typeof value !== "string" || !/^\+1\d{10}$/.test(value))) errors[field.name] = typeof field.settings?.errorMessage === "string" && field.settings.errorMessage ? field.settings.errorMessage : "Enter a valid USA phone number.";
    if (value !== undefined && typeof value === "string" && typeof field.settings?.maxLength === "number" && field.settings.maxLength >= 0 && value.length > field.settings.maxLength) errors[field.name] = `Use ${field.settings.maxLength} characters or fewer.`;
    if (field.type === "date" && value && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) errors[field.name] = "Enter a valid date.";
    if (field.type === "select" || field.type === "radio" || field.type === "checkbox") {
      const groupedOptions = Array.isArray(field.settings?.optionGroups) ? field.settings.optionGroups.flatMap((group) => group && typeof group === "object" && !Array.isArray(group) && Array.isArray((group as { options?: unknown }).options) ? (group as { options: FormOption[] }).options : []) : [];
      const allowed = new Set([...((field.options ?? []).map((option) => option.value)), ...groupedOptions.map((option) => option.value)]);
      const valuesToCheck = field.type === "checkbox" && Array.isArray(value) ? value : [value];
      if (value && valuesToCheck.some((item) => typeof item !== "string" || (field.settings?.allowCustomValues !== true && field.settings?.allowOther !== true && allowed.size > 0 && !allowed.has(item)))) errors[field.name] = "Choose a valid option.";
    }
    if (field.type === "ranking") {
      if (value && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) errors[field.name] = "Invalid ranking.";
    }
    if (field.type === "checkbox" || field.type === "terms") {
      if (field.type === "terms" && value !== undefined && typeof value !== "boolean") errors[field.name] = "Invalid checkbox value.";
      if (field.type === "checkbox" && value !== undefined && typeof value !== "boolean" && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) errors[field.name] = "Invalid checkbox value.";
    }
    if (field.type === "file" && value) {
      const files = Array.isArray(value) ? value : [value];
      const maxFiles = typeof field.settings?.maxFiles === "number" && field.settings.maxFiles > 0 ? Math.floor(field.settings.maxFiles) : 1;
      const maxSize = typeof field.settings?.maxFileSize === "number" && field.settings.maxFileSize > 0 ? field.settings.maxFileSize * 1024 * 1024 : 20_000_000;
      const allowed = Array.isArray(field.settings?.allowedFiles) ? field.settings.allowedFiles.filter((item): item is string => typeof item === "string") : [];
      const mimeGroups: Record<string, string[]> = { images: ["image/"], audio: ["audio/"], video: ["video/"], pdf: ["application/pdf"], docs: ["application/msword", "application/vnd.openxmlformats-officedocument", "text/plain", "application/rtf"], zip: ["application/zip", "application/x-rar", "application/x-7z-compressed", "application/gzip"], executable: ["application/x-msdownload", "application/vnd.microsoft.portable-executable", "application/x-executable"], csv: ["text/csv", "application/csv"] };
      if (files.length > maxFiles) errors[field.name] = typeof field.settings?.maxFilesErrorMessage === "string" && field.settings.maxFilesErrorMessage ? field.settings.maxFilesErrorMessage : "Too many files selected.";
      const normalized = files.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) { errors[field.name] = "Invalid file value."; return []; }
        const file = candidate as Record<string, unknown>;
        const name = typeof file.name === "string" ? file.name.slice(0, 200) : "uploaded-file";
        const size = typeof file.size === "number" && file.size >= 0 ? file.size : 0;
        const type = typeof file.type === "string" ? file.type.slice(0, 100) : "application/octet-stream";
        if (size > maxSize) errors[field.name] = typeof field.settings?.errorMessage === "string" && field.settings.errorMessage ? field.settings.errorMessage : "This file exceeds the maximum size.";
        if (allowed.length && !allowed.some((group) => (mimeGroups[group] ?? []).some((prefix) => type === prefix || type.startsWith(prefix)))) errors[field.name] = typeof field.settings?.unauthorizedErrorMessage === "string" && field.settings.unauthorizedErrorMessage ? field.settings.unauthorizedErrorMessage : "This file type is not allowed.";
        return [{ name, size, type }];
      });
      values[field.name] = maxFiles > 1 ? normalized.slice(0, maxFiles) : normalized[0];
    }
    if (!errors[field.name] && value !== undefined && values[field.name] === undefined) values[field.name] = typeof value === "string" ? value.slice(0, 10000) : Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 100) : typeof value === "boolean" ? value : field.type === "chained-select" && value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item).slice(0, 200)])) : String(value).slice(0, 10000);
  }
  return { definition, values, errors, valid: Object.keys(errors).length === 0 };
}

export function sanitizeFormHtml(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi, "");
}
