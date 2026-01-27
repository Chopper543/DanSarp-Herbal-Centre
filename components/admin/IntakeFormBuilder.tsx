"use client";

import { useState } from "react";
import { IntakeForm, FormSchema, FormField, FormFieldType } from "@/types";
import { Save, X, Plus, Trash2, GripVertical } from "lucide-react";

interface IntakeFormBuilderProps {
  form?: IntakeForm;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function IntakeFormBuilder({
  form,
  onSave,
  onCancel,
  loading = false,
}: IntakeFormBuilderProps) {
  const [formData, setFormData] = useState({
    name: form?.name || "",
    description: form?.description || "",
    is_active: form?.is_active !== undefined ? form.is_active : true,
    required_for_booking: Boolean((form as any)?.required_for_booking),
    form_schema: (form?.form_schema || { fields: [] }) as FormSchema,
  });

  const [newField, setNewField] = useState<Partial<FormField>>({
    type: "text",
    label: "",
    name: "",
    required: false,
  });

  const fieldTypes: FormFieldType[] = [
    "text",
    "textarea",
    "select",
    "checkbox",
    "radio",
    "date",
    "file",
    "number",
    "email",
    "tel",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.form_schema.fields.length === 0) {
      alert("Form name and at least one field are required");
      return;
    }
    await onSave(formData);
  };

  const addField = () => {
    if (!newField.label || !newField.name) {
      alert("Field label and name are required");
      return;
    }

    const field: FormField = {
      id: `field_${Date.now()}`,
      type: (newField.type || "text") as FormFieldType,
      label: newField.label,
      name: newField.name,
      placeholder: newField.placeholder,
      required: newField.required || false,
      options: newField.options || [],
      help_text: newField.help_text,
    };

    setFormData({
      ...formData,
      form_schema: {
        ...formData.form_schema,
        fields: [...formData.form_schema.fields, field],
      },
    });

    setNewField({
      type: "text",
      label: "",
      name: "",
      required: false,
    });
  };

  const removeField = (index: number) => {
    setFormData({
      ...formData,
      form_schema: {
        ...formData.form_schema,
        fields: formData.form_schema.fields.filter((_, i) => i !== index),
      },
    });
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const updated = [...formData.form_schema.fields];
    updated[index] = { ...updated[index], ...updates };
    setFormData({
      ...formData,
      form_schema: {
        ...formData.form_schema,
        fields: updated,
      },
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {form ? "Edit Intake Form" : "Create Intake Form"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Form Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={formData.is_active ? "active" : "inactive"}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.value === "active" })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={formData.required_for_booking}
              onChange={(e) => setFormData({ ...formData, required_for_booking: e.target.checked })}
              className="mt-1 rounded"
            />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Required before booking
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                If enabled, patients must submit this form before they can proceed to appointment
                payment/booking.
              </div>
            </div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Form Fields
          </h3>
          <div className="space-y-4">
            {formData.form_schema.fields.map((field, index) => (
              <div
                key={field.id || index}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {field.label || `Field ${index + 1}`}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({field.type})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Field Name
                    </label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(index, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Type
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, { type: e.target.value as FormFieldType })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    >
                      {fieldTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                        className="rounded"
                      />
                      Required
                    </label>
                  </div>
                  {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Options (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={field.options?.join(", ") || ""}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Option 1, Option 2, Option 3"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Add New Field</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newField.label || ""}
                    onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Field Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newField.name || ""}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Type
                  </label>
                  <select
                    value={newField.type || "text"}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value as FormFieldType })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                  >
                    {fieldTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addField}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Field
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Form
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
