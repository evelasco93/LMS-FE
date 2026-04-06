"use client";

import PhoneInput from "react-phone-input-2";

export function PhoneField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="phone-input-wrapper">
      <PhoneInput
        country="us"
        value={(value || "").replace(/^\+/, "")}
        onChange={(val) => {
          const normalized = val.startsWith("+") ? val : `+${val}`;
          onChange(normalized);
        }}
        enableSearch
        inputClass="phone-input-field"
        buttonClass="phone-input-button"
        dropdownClass="phone-input-dropdown"
        inputProps={{ required }}
      />
    </div>
  );
}
