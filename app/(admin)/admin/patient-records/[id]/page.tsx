"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Trash2, Eye, User, Calendar, Phone, Mail, MapPin, AlertCircle, Heart, FileText, Stethoscope, Shield } from "lucide-react";
import { PatientRecordForm } from "@/components/admin/PatientRecordForm";
import { PatientRecord, GenderType, MaritalStatusType, DoctorNote, MedicalHistoryEntry } from "@/types";
import { Suspense } from "react";

function PatientRecordDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("edit") === "true";
  const routeId = (params?.id as string) || "";
  const isNew = routeId === "new";
  const userId = isNew ? "" : routeId;

  const [record, setRecord] = useState<PatientRecord & { users?: { id: string; email: string; full_name: string | null; phone: string | null } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editMode, setEditMode] = useState(isEdit || isNew);

  useEffect(() => {
    if (!isNew && userId) {
      fetchRecord();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isNew, routeId]);

  const fetchRecord = async () => {
    try {
      const response = await fetch(`/api/patient-records?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setRecord(data.record);
      } else {
        setError("Failed to load patient record");
      }
    } catch (error) {
      console.error("Failed to fetch record:", error);
      setError("Failed to load patient record");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const url = "/api/patient-records";
      const method = record ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save record");
      }

      setSuccess(true);
      setTimeout(() => {
        if (isNew) {
          router.push("/admin/patient-records");
        } else {
          setEditMode(false);
          fetchRecord();
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this patient record? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/patient-records?user_id=${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete record");
      }

      router.push("/admin/patient-records");
    } catch (err: any) {
      setError(err.message || "Failed to delete record");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (editMode || isNew) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/patient-records"
              className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isNew ? "Create Patient Record" : "Edit Patient Record"}
            </h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
            Patient record saved successfully!
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <PatientRecordForm
            record={record || undefined}
            userId={isNew ? userId : undefined}
            onSave={handleSave}
            onCancel={() => {
              if (isNew) {
                router.push("/admin/patient-records");
              } else {
                setEditMode(false);
                fetchRecord();
              }
            }}
            loading={saving}
          />
        </div>
      </div>
    );
  }

  // View Mode
  if (!record) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/patient-records"
            className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Patient Record Not Found
          </h1>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-600 dark:text-gray-400">
            The patient record you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const user = record.users;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/patient-records"
            className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Patient Record
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
          >
            <Edit className="w-5 h-5" />
            Edit Record
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-950 text-white rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* Patient Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {user?.full_name || "N/A"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Patient</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4" />
              <span>{user?.email || "N/A"}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Phone className="w-4 h-4" />
              <span>{user?.phone || record.alternative_phone || "N/A"}</span>
            </div>
            {record.age && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Age: {record.age} years</span>
              </div>
            )}
          </div>
        </div>

        {/* Medical Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Heart className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Medical Summary
              </h2>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Condition: </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {record.primary_condition || "Not specified"}
              </span>
            </div>
            {record.blood_type && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Blood Type: </span>
                <span className="text-gray-900 dark:text-white font-medium">{record.blood_type}</span>
              </div>
            )}
            {record.allergies && record.allergies.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Allergies: </span>
                <span className="text-gray-900 dark:text-white">
                  {record.allergies.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Visit Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Visit Summary
              </h2>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Total Visits: </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {record.total_visits || 0}
              </span>
            </div>
            {record.first_visit_date && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">First Visit: </span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(record.first_visit_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {record.last_visit_date && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Last Visit: </span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(record.last_visit_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Demographics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5" />
            Demographics
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Date of Birth: </span>
              <span className="text-gray-900 dark:text-white">
                {record.date_of_birth ? new Date(record.date_of_birth).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Gender: </span>
              <span className="text-gray-900 dark:text-white">
                {record.gender ? record.gender.charAt(0).toUpperCase() + record.gender.slice(1) : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Marital Status: </span>
              <span className="text-gray-900 dark:text-white">
                {record.marital_status ? record.marital_status.charAt(0).toUpperCase() + record.marital_status.slice(1) : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Occupation: </span>
              <span className="text-gray-900 dark:text-white">{record.occupation || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Contact Information
          </h3>
          <div className="space-y-3 text-sm">
            {record.home_address && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Address: </span>
                <span className="text-gray-900 dark:text-white">{record.home_address}</span>
              </div>
            )}
            {record.city && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">City: </span>
                <span className="text-gray-900 dark:text-white">{record.city}</span>
              </div>
            )}
            {record.region && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Region: </span>
                <span className="text-gray-900 dark:text-white">{record.region}</span>
              </div>
            )}
            {record.postal_code && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Postal Code: </span>
                <span className="text-gray-900 dark:text-white">{record.postal_code}</span>
              </div>
            )}
            {record.alternative_phone && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Alternative Phone: </span>
                <span className="text-gray-900 dark:text-white">{record.alternative_phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Emergency Contact */}
        {record.emergency_contact_name && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Emergency Contact
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Name: </span>
                <span className="text-gray-900 dark:text-white">{record.emergency_contact_name}</span>
              </div>
              {record.emergency_contact_phone && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Phone: </span>
                  <span className="text-gray-900 dark:text-white">{record.emergency_contact_phone}</span>
                </div>
              )}
              {record.emergency_contact_relationship && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Relationship: </span>
                  <span className="text-gray-900 dark:text-white">{record.emergency_contact_relationship}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5" />
            Medical Information
          </h3>
          <div className="space-y-3 text-sm">
            {record.condition_started_date && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Condition Started: </span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(record.condition_started_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {record.current_medications && record.current_medications.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Current Medications: </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {record.current_medications.map((med, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs"
                    >
                      {med}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {record.medical_history && record.medical_history.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Medical History: </span>
                <div className="mt-2 space-y-2">
                  {record.medical_history.map((entry, index) => (
                    <div key={index} className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                      <span className="font-medium">{entry.condition}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        ({entry.started} {entry.ended ? `- ${entry.ended}` : ""})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Doctor Notes */}
        {record.doctor_notes && record.doctor_notes.length > 0 && (
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Doctor Notes
            </h3>
            <div className="space-y-4">
              {record.doctor_notes.map((note, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{note.doctor}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(note.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.report}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Information */}
        {(record.insurance_provider || record.referral_source || record.notes) && (
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Additional Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {record.insurance_provider && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Insurance Provider: </span>
                  <span className="text-gray-900 dark:text-white">{record.insurance_provider}</span>
                </div>
              )}
              {record.insurance_number && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Insurance Number: </span>
                  <span className="text-gray-900 dark:text-white">{record.insurance_number}</span>
                </div>
              )}
              {record.referral_source && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Referral Source: </span>
                  <span className="text-gray-900 dark:text-white">{record.referral_source}</span>
                </div>
              )}
              {record.preferred_language && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Preferred Language: </span>
                  <span className="text-gray-900 dark:text-white">{record.preferred_language}</span>
                </div>
              )}
              {record.notes && (
                <div className="md:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">Notes: </span>
                  <p className="text-gray-900 dark:text-white mt-1">{record.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PatientRecordDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PatientRecordDetailContent />
    </Suspense>
  );
}
