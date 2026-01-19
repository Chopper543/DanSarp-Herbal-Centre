"use client";

import { useState, useEffect } from "react";
import { PatientRecord, GenderType, MaritalStatusType, DoctorNote, MedicalHistoryEntry } from "@/types";
import { Save, X, Plus, Trash2, Calendar } from "lucide-react";

interface PatientRecordFormProps {
  record?: PatientRecord & { users?: { id: string; email: string; full_name: string | null; phone: string | null } };
  userId?: string;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function PatientRecordForm({
  record,
  userId,
  onSave,
  onCancel,
  loading = false,
}: PatientRecordFormProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState({
    user_id: userId || record?.user_id || "",
    // Demographics
    date_of_birth: record?.date_of_birth || "",
    gender: (record?.gender || "") as GenderType | "",
    marital_status: (record?.marital_status || "") as MaritalStatusType | "",
    occupation: record?.occupation || "",
    // Contact Information
    home_address: record?.home_address || "",
    city: record?.city || "",
    region: record?.region || "",
    postal_code: record?.postal_code || "",
    alternative_phone: record?.alternative_phone || "",
    // Emergency Contact
    emergency_contact_name: record?.emergency_contact_name || "",
    emergency_contact_phone: record?.emergency_contact_phone || "",
    emergency_contact_relationship: record?.emergency_contact_relationship || "",
    // Medical Information
    primary_condition: record?.primary_condition || "",
    condition_started_date: record?.condition_started_date || "",
    medical_history: (record?.medical_history || []) as MedicalHistoryEntry[],
    allergies: (record?.allergies || []) as string[],
    current_medications: (record?.current_medications || []) as string[],
    blood_type: record?.blood_type || "",
    // Doctor Notes
    doctor_notes: (record?.doctor_notes || []) as DoctorNote[],
    // Additional Information
    insurance_provider: record?.insurance_provider || "",
    insurance_number: record?.insurance_number || "",
    referral_source: record?.referral_source || "",
    preferred_language: record?.preferred_language || "en",
    notes: record?.notes || "",
  });

  const [newAllergy, setNewAllergy] = useState("");
  const [newMedication, setNewMedication] = useState("");
  const [newMedicalHistory, setNewMedicalHistory] = useState<MedicalHistoryEntry>({
    condition: "",
    started: "",
    ended: "",
    notes: "",
  });
  const [newDoctorNote, setNewDoctorNote] = useState<DoctorNote>({
    date: new Date().toISOString().split("T")[0],
    doctor: "",
    report: "",
    attachments: [],
  });

  const tabs = [
    { id: "basic", label: "Basic Information" },
    { id: "contact", label: "Contact Information" },
    { id: "emergency", label: "Emergency Contact" },
    { id: "medical", label: "Medical Information" },
    { id: "doctor-notes", label: "Doctor Notes" },
    { id: "additional", label: "Additional Information" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setFormData({
        ...formData,
        allergies: [...formData.allergies, newAllergy.trim()],
      });
      setNewAllergy("");
    }
  };

  const removeAllergy = (index: number) => {
    setFormData({
      ...formData,
      allergies: formData.allergies.filter((_, i) => i !== index),
    });
  };

  const addMedication = () => {
    if (newMedication.trim()) {
      setFormData({
        ...formData,
        current_medications: [...formData.current_medications, newMedication.trim()],
      });
      setNewMedication("");
    }
  };

  const removeMedication = (index: number) => {
    setFormData({
      ...formData,
      current_medications: formData.current_medications.filter((_, i) => i !== index),
    });
  };

  const addMedicalHistory = () => {
    if (newMedicalHistory.condition && newMedicalHistory.started) {
      setFormData({
        ...formData,
        medical_history: [...formData.medical_history, { ...newMedicalHistory }],
      });
      setNewMedicalHistory({ condition: "", started: "", ended: "", notes: "" });
    }
  };

  const removeMedicalHistory = (index: number) => {
    setFormData({
      ...formData,
      medical_history: formData.medical_history.filter((_, i) => i !== index),
    });
  };

  const addDoctorNote = () => {
    if (newDoctorNote.doctor && newDoctorNote.report) {
      setFormData({
        ...formData,
        doctor_notes: [...formData.doctor_notes, { ...newDoctorNote }],
      });
      setNewDoctorNote({
        date: new Date().toISOString().split("T")[0],
        doctor: "",
        report: "",
        attachments: [],
      });
    }
  };

  const removeDoctorNote = (index: number) => {
    setFormData({
      ...formData,
      doctor_notes: formData.doctor_notes.filter((_, i) => i !== index),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Basic Information */}
        {activeTab === "basic" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                User ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter user ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer Not to Say</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Marital Status
              </label>
              <select
                value={formData.marital_status}
                onChange={(e) => setFormData({ ...formData, marital_status: e.target.value as MaritalStatusType })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select Marital Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
                <option value="separated">Separated</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Occupation
              </label>
              <input
                type="text"
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter occupation"
              />
            </div>
          </div>
        )}

        {/* Contact Information */}
        {activeTab === "contact" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Home Address
              </label>
              <input
                type="text"
                value={formData.home_address}
                onChange={(e) => setFormData({ ...formData, home_address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter home address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter city"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Region
              </label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter region"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Postal Code
              </label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter postal code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Alternative Phone
              </label>
              <input
                type="tel"
                value={formData.alternative_phone}
                onChange={(e) => setFormData({ ...formData, alternative_phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter alternative phone"
              />
            </div>
          </div>
        )}

        {/* Emergency Contact */}
        {activeTab === "emergency" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter emergency contact name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter emergency contact phone"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Relationship
              </label>
              <input
                type="text"
                value={formData.emergency_contact_relationship}
                onChange={(e) => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Spouse, Parent, Sibling"
              />
            </div>
          </div>
        )}

        {/* Medical Information */}
        {activeTab === "medical" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Primary Condition
                </label>
                <input
                  type="text"
                  value={formData.primary_condition}
                  onChange={(e) => setFormData({ ...formData, primary_condition: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter primary condition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Condition Started Date
                </label>
                <input
                  type="date"
                  value={formData.condition_started_date}
                  onChange={(e) => setFormData({ ...formData, condition_started_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Blood Type
                </label>
                <select
                  value={formData.blood_type}
                  onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select Blood Type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Allergies
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addAllergy())}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter allergy and press Enter"
                />
                <button
                  type="button"
                  onClick={addAllergy}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.allergies.map((allergy, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => removeAllergy(index)}
                      className="hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Current Medications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Medications
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newMedication}
                  onChange={(e) => setNewMedication(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addMedication())}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter medication and press Enter"
                />
                <button
                  type="button"
                  onClick={addMedication}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.current_medications.map((medication, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                  >
                    {medication}
                    <button
                      type="button"
                      onClick={() => removeMedication(index)}
                      className="hover:text-blue-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Medical History */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Medical History
              </label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-2 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newMedicalHistory.condition}
                    onChange={(e) => setNewMedicalHistory({ ...newMedicalHistory, condition: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Condition"
                  />
                  <input
                    type="date"
                    value={newMedicalHistory.started}
                    onChange={(e) => setNewMedicalHistory({ ...newMedicalHistory, started: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={newMedicalHistory.ended}
                    onChange={(e) => setNewMedicalHistory({ ...newMedicalHistory, ended: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Ended (optional)"
                  />
                  <input
                    type="text"
                    value={newMedicalHistory.notes}
                    onChange={(e) => setNewMedicalHistory({ ...newMedicalHistory, notes: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Notes (optional)"
                  />
                </div>
                <button
                  type="button"
                  onClick={addMedicalHistory}
                  className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
                >
                  Add Medical History Entry
                </button>
              </div>
              <div className="space-y-2">
                {formData.medical_history.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{entry.condition}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                        {entry.started} {entry.ended ? `- ${entry.ended}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedicalHistory(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Doctor Notes */}
        {activeTab === "doctor-notes" && (
          <div className="space-y-6">
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="date"
                  value={newDoctorNote.date}
                  onChange={(e) => setNewDoctorNote({ ...newDoctorNote, date: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="text"
                  value={newDoctorNote.doctor}
                  onChange={(e) => setNewDoctorNote({ ...newDoctorNote, doctor: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Doctor Name"
                />
              </div>
              <textarea
                value={newDoctorNote.report}
                onChange={(e) => setNewDoctorNote({ ...newDoctorNote, report: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Doctor's Report"
              />
              <button
                type="button"
                onClick={addDoctorNote}
                className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
              >
                Add Doctor Note
              </button>
            </div>

            <div className="space-y-4">
              {formData.doctor_notes.map((note, index) => (
                <div
                  key={index}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{note.doctor}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(note.date).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDoctorNote(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.report}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Information */}
        {activeTab === "additional" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Insurance Provider
              </label>
              <input
                type="text"
                value={formData.insurance_provider}
                onChange={(e) => setFormData({ ...formData, insurance_provider: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter insurance provider"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Insurance Number
              </label>
              <input
                type="text"
                value={formData.insurance_number}
                onChange={(e) => setFormData({ ...formData, insurance_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter insurance number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Referral Source
              </label>
              <input
                type="text"
                value={formData.referral_source}
                onChange={(e) => setFormData({ ...formData, referral_source: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="How did they hear about us?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preferred Language
              </label>
              <select
                value={formData.preferred_language}
                onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="en">English</option>
                <option value="tw">Twi</option>
                <option value="ga">Ga</option>
                <option value="ewe">Ewe</option>
                <option value="ha">Hausa</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                General Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter any additional notes"
              />
            </div>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {loading ? "Saving..." : "Save Record"}
        </button>
      </div>
    </form>
  );
}
