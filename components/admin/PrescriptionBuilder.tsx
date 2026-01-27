"use client";

import { useState, useEffect } from "react";
import { Prescription, HerbFormula, Appointment } from "@/types";
import { Save, X, Plus, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { validatePrescription, InteractionWarning } from "@/lib/clinical/prescription-validator";

interface PrescriptionBuilderProps {
  prescription?: Prescription;
  patientId?: string;
  appointmentId?: string;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function PrescriptionBuilder({
  prescription,
  patientId,
  appointmentId,
  onSave,
  onCancel,
  loading = false,
}: PrescriptionBuilderProps) {
  const [formData, setFormData] = useState({
    patient_id: patientId || prescription?.patient_id || "",
    appointment_id: appointmentId || prescription?.appointment_id || "",
    herbs_formulas: (prescription?.herbs_formulas || []) as HerbFormula[],
    instructions: prescription?.instructions || "",
    duration_days: prescription?.duration_days || null,
    refills_original: prescription?.refills_original || 0,
    expiry_date: prescription?.expiry_date || "",
    start_date: prescription?.start_date || "",
    doctor_notes: prescription?.doctor_notes || "",
  });

  const [newHerb, setNewHerb] = useState<HerbFormula>({
    name: "",
    quantity: 0,
    unit: "grams",
    dosage: "",
    instructions: "",
  });

  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: InteractionWarning[];
  } | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (patientId) {
      fetch(`/api/appointments?patient_id=${patientId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.appointments) {
            setAppointments(data.appointments);
          }
        })
        .catch(console.error);
    }
  }, [patientId]);

  useEffect(() => {
    const result = validatePrescription(formData);
    setValidation(result);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validation && !validation.valid) {
      return;
    }
    await onSave(formData);
  };

  const addHerb = () => {
    if (newHerb.name && newHerb.quantity > 0 && newHerb.dosage) {
      setFormData({
        ...formData,
        herbs_formulas: [...formData.herbs_formulas, { ...newHerb }],
      });
      setNewHerb({
        name: "",
        quantity: 0,
        unit: "grams",
        dosage: "",
        instructions: "",
      });
    }
  };

  const removeHerb = (index: number) => {
    setFormData({
      ...formData,
      herbs_formulas: formData.herbs_formulas.filter((_, i) => i !== index),
    });
  };

  const updateHerb = (index: number, field: keyof HerbFormula, value: any) => {
    const updated = [...formData.herbs_formulas];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, herbs_formulas: updated });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {prescription ? "Edit Prescription" : "Create Prescription"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {validation && validation.errors.length > 0 && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <strong>Validation Errors:</strong>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {validation.errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation && validation.warnings.length > 0 && (
        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <strong>Warnings:</strong>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {validation.warnings.map((warning, idx) => (
              <li key={idx}>
                <span className={`font-semibold ${warning.severity === "high" ? "text-red-600 dark:text-red-400" : ""}`}>
                  [{warning.severity.toUpperCase()}]
                </span>{" "}
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Patient ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.patient_id}
              onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Appointment (Optional)
            </label>
            <select
              value={formData.appointment_id || ""}
              onChange={(e) => setFormData({ ...formData, appointment_id: e.target.value || "" })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select appointment...</option>
              {appointments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {new Date(apt.appointment_date).toLocaleString()} - {apt.treatment_type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Herbs/Formulas <span className="text-red-500">*</span>
          </label>
          <div className="space-y-4">
            {formData.herbs_formulas.map((herb, index) => (
              <div
                key={index}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700"
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Herb/Formula {index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeHerb(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={herb.name}
                      onChange={(e) => updateHerb(index, "name", e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={herb.quantity}
                        onChange={(e) => updateHerb(index, "quantity", parseFloat(e.target.value) || 0)}
                        required
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Unit <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={herb.unit}
                        onChange={(e) => updateHerb(index, "unit", e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                      >
                        <option value="grams">Grams</option>
                        <option value="ml">Milliliters</option>
                        <option value="tablets">Tablets</option>
                        <option value="capsules">Capsules</option>
                        <option value="drops">Drops</option>
                        <option value="teaspoons">Teaspoons</option>
                        <option value="tablespoons">Tablespoons</option>
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Dosage Instructions <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={herb.dosage}
                      onChange={(e) => updateHerb(index, "dosage", e.target.value)}
                      required
                      placeholder="e.g., 2 tablets twice daily"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Additional Instructions (Optional)
                    </label>
                    <textarea
                      value={herb.instructions || ""}
                      onChange={(e) => updateHerb(index, "instructions", e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Add New Herb/Formula</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newHerb.name}
                    onChange={(e) => setNewHerb({ ...newHerb, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newHerb.quantity}
                      onChange={(e) => setNewHerb({ ...newHerb, quantity: parseFloat(e.target.value) || 0 })}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newHerb.unit}
                      onChange={(e) => setNewHerb({ ...newHerb, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                    >
                      <option value="grams">Grams</option>
                      <option value="ml">Milliliters</option>
                      <option value="tablets">Tablets</option>
                      <option value="capsules">Capsules</option>
                      <option value="drops">Drops</option>
                      <option value="teaspoons">Teaspoons</option>
                      <option value="tablespoons">Tablespoons</option>
                    </select>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Dosage Instructions <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newHerb.dosage}
                    onChange={(e) => setNewHerb({ ...newHerb, dosage: e.target.value })}
                    placeholder="e.g., 2 tablets twice daily"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-600 dark:text-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={addHerb}
                    disabled={!newHerb.name || newHerb.quantity <= 0 || !newHerb.dosage}
                    className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Herb/Formula
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            General Instructions
          </label>
          <textarea
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="General instructions for taking all medications..."
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Duration (Days)
            </label>
            <input
              type="number"
              value={formData.duration_days || ""}
              onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || null })}
              min="1"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expiry Date
            </label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Refills Allowed
            </label>
            <input
              type="number"
              value={formData.refills_original}
              onChange={(e) => setFormData({ ...formData, refills_original: parseInt(e.target.value) || 0 })}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Doctor Notes
          </label>
          <textarea
            value={formData.doctor_notes}
            onChange={(e) => setFormData({ ...formData, doctor_notes: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Internal notes for this prescription..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || (validation && !validation.valid)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {prescription ? "Update Prescription" : "Create Prescription"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
