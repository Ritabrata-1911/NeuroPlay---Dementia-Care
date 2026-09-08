import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../SupabaseClient';
import './PersonalizedMemoryGame.css';

// ─── CAREGIVER panel — embedded in CaregiverDashboard ─────────────────────────
export function MemoryPhotosPanel({ patientId }) {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('list'); // list | add | edit
    const [editPhoto, setEditPhoto] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const fileRef = useRef();

    const emptyForm = { personName: '', relationship: '', occasion: '', location: '', year: '', significance: '', context: '', culturalContext: '' };
    const [form, setForm] = useState(emptyForm);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [file, setFile] = useState(null);

    const loadPhotos = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        const { data, error: e } = await supabase
            .from('patient_photos')
            .select('id, url, metadata, created_at')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });
        if (!e) setPhotos(data || []);
        setLoading(false);
    }, [patientId]);

    useEffect(() => { loadPhotos(); }, [loadPhotos]);

    const resetForm = () => {
        setForm(emptyForm);
        setPreviewUrl(null);
        setFile(null);
        setError('');
        setSuccess('');
        setEditPhoto(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(f.type)) { setError('Please upload a JPEG, PNG, or WEBP image.'); return; }
        if (f.size > 10 * 1024 * 1024) { setError('Image must be under 10MB.'); return; }
        setFile(f); setError('');
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewUrl(ev.target.result);
        reader.readAsDataURL(f);
    };

    const handleSave = async () => {
        if (!form.personName.trim()) { setError("Please enter the person's name."); return; }
        if (mode === 'add' && !file) { setError('Please select a photograph.'); return; }
        setUploading(true); setError('');
        try {
            let url = editPhoto?.url || '';

            // ── Upload photo to storage (only when a new file is selected) ──
            if (file) {
                const filePath = `${patientId}/${Date.now()}_memory.jpg`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('patient-memories')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Retrieve the public URL for storage/display
                const { data: { publicUrl } } = supabase.storage
                    .from('patient-memories')
                    .getPublicUrl(filePath);

                url = publicUrl;
            }

            // ── Insert / update metadata row in patient_photos ──────────────
            const metadata = {
                personName: form.personName.trim(),
                relationship: form.relationship.trim(),
                occasion: form.occasion.trim(),
                location: form.location.trim(),
                year: form.year.trim(),
                significance: form.significance.trim(),
                context: form.context.trim(),
                culturalContext: form.culturalContext.trim(),
            };

            if (mode === 'add') {
                const { error } = await supabase
                    .from('patient_photos')
                    .insert([{ patient_id: patientId, url, metadata }]);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('patient_photos')
                    .update({ url, metadata })
                    .eq('id', editPhoto.id);
                if (error) throw error;
            }

            setSuccess(mode === 'add' ? 'Photograph saved!' : 'Photograph updated!');
            await loadPhotos();
            resetForm();
            setMode('list');
        } catch (err) {
            setError("We couldn't save this memory right now. Please try again.");
            console.error('[MemoryPhotosPanel] save error:', err);
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (photo) => {
        const m = photo.metadata || {};
        setForm({
            personName: m.personName || '', relationship: m.relationship || '', occasion: m.occasion || '',
            location: m.location || '', year: m.year || '', significance: m.significance || '',
            context: m.context || '', culturalContext: m.culturalContext || '',
        });
        setPreviewUrl(photo.url);
        setEditPhoto(photo);
        setMode('edit');
        setError(''); setSuccess('');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remove this photograph from the memory game?')) return;
        setDeletingId(id);
        const { error: e } = await supabase.from('patient_photos').delete().eq('id', id);
        if (!e) await loadPhotos();
        else setError("Couldn't remove this photograph. Please try again.");
        setDeletingId(null);
    };

    // Field is defined outside this component (see below) to keep its identity stable across renders.

    return (
        <div className="pmg-cg-panel">
            <div className="pmg-cg-panel-header">
                <div>
                    <h3 className="pmg-cg-panel-title">📷 Memory Photographs</h3>
                    <p className="pmg-cg-panel-sub">
                        Upload photographs meaningful to the patient — family, friends, occasions.
                        The memory game will generate personalised questions from each one.
                    </p>
                </div>
                {mode === 'list' && (
                    <button
                        className="pmg-cg-add-btn"
                        onClick={() => { resetForm(); setMode('add'); }}
                    >
                        + Add photograph
                    </button>
                )}
            </div>

            {success && <div className="pmg-cg-alert pmg-cg-alert-success">✓ {success}</div>}
            {error && <div className="pmg-cg-alert pmg-cg-alert-error">⚠ {error}</div>}

            {/* List */}
            {mode === 'list' && (
                <>
                    {loading ? (
                        <div className="pmg-cg-loading">Loading photographs…</div>
                    ) : photos.length === 0 ? (
                        <div className="pmg-cg-empty">
                            <div className="pmg-cg-empty-icon">🏔️</div>
                            <p>No photographs added yet.</p>
                            <p className="pmg-muted">Add meaningful photographs to personalise the memory game.</p>
                        </div>
                    ) : (
                        <div className="pmg-cg-photo-grid">
                            {photos.map((photo) => (
                                <div key={photo.id} className="pmg-cg-photo-card">
                                    <div className="pmg-cg-photo-thumb">
                                        <img
                                            src={photo.url}
                                            alt={photo.metadata?.personName || 'Memory'}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                    <div className="pmg-cg-photo-info">
                                        <strong>{photo.metadata?.personName || 'Unknown'}</strong>
                                        <span className="pmg-muted">
                                            {[photo.metadata?.relationship, photo.metadata?.occasion].filter(Boolean).join(' · ')}
                                        </span>
                                    </div>
                                    <div className="pmg-cg-photo-actions">
                                        <button className="pmg-cg-edit-btn" onClick={() => handleEdit(photo)}>Edit</button>
                                        <button
                                            className="pmg-cg-delete-btn"
                                            onClick={() => handleDelete(photo.id)}
                                            disabled={deletingId === photo.id}
                                        >
                                            {deletingId === photo.id ? '…' : 'Remove'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Add / Edit form */}
            {(mode === 'add' || mode === 'edit') && (
                <div className="pmg-cg-form-card">
                    <h4 className="pmg-cg-form-title">
                        {mode === 'add' ? 'Add a new photograph' : 'Edit photograph'}
                    </h4>

                    {/* Photo upload */}
                    <div className="pmg-cg-field">
                        <label className="pmg-cg-label">Photograph</label>
                        <div
                            className={`pmg-cg-dropzone ${previewUrl ? 'has-preview' : ''}`}
                            onClick={() => fileRef.current?.click()}
                        >
                            {previewUrl
                                ? <img src={previewUrl} alt="Preview" className="pmg-cg-preview-img" />
                                : (
                                    <div className="pmg-cg-dropzone-placeholder">
                                        <span className="pmg-cg-dropzone-icon">📸</span>
                                        <span>Tap to choose a photograph</span>
                                        <span className="pmg-muted" style={{ fontSize: '0.8rem' }}>JPEG, PNG or WEBP · Max 10 MB</span>
                                    </div>
                                )
                            }
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        {previewUrl && (
                            <button
                                className="pmg-cg-remove-photo"
                                onClick={() => { setPreviewUrl(null); setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                            >
                                Remove photo
                            </button>
                        )}
                    </div>

                    <MemoryField label="Person / people shown" name="personName" placeholder="e.g. Ananya" form={form} setForm={setForm} />
                    <MemoryField label="Relationship with patient" name="relationship" placeholder="e.g. Daughter, Son, Friend" form={form} setForm={setForm} />
                    <MemoryField label="Occasion or event" name="occasion" placeholder="e.g. Sister's Wedding, Birthday" optional form={form} setForm={setForm} />
                    <MemoryField label="Location" name="location" placeholder="e.g. Shillong, Guwahati" optional form={form} setForm={setForm} />
                    <MemoryField label="Year or approximate time" name="year" placeholder="e.g. 2019, Around 2015" optional form={form} setForm={setForm} />
                    <MemoryField label="Why is this memory special?" name="significance" placeholder="Describe what makes this photograph meaningful…" multiline optional form={form} setForm={setForm} />
                    <MemoryField label="Additional context" name="context" placeholder="Any other details to help recall this memory…" multiline optional form={form} setForm={setForm} />
                    <MemoryField label="Cultural context" name="culturalContext" placeholder="Traditional dress, festival, regional custom…" optional form={form} setForm={setForm} />

                    <div className="pmg-cg-form-actions">
                        <button
                            className="pmg-cg-cancel-btn"
                            onClick={() => { resetForm(); setMode('list'); }}
                        >
                            Cancel
                        </button>
                        <button
                            className="pmg-cg-save-btn"
                            onClick={handleSave}
                            disabled={uploading}
                        >
                            {uploading ? 'Saving…' : mode === 'add' ? 'Save photograph' : 'Update photograph'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Stable field component — defined OUTSIDE MemoryPhotosPanel ────────────
// Keeping it outside prevents React from treating it as a new component type
// on every render, which would unmount/remount the input and lose focus.
function MemoryField({ label, name, placeholder, multiline, optional, form, setForm }) {
    return (
        <div className="pmg-cg-field">
            <label className="pmg-cg-label">
                {label}
                {optional && <span className="pmg-cg-optional"> (optional)</span>}
            </label>
            {multiline
                ? (
                    <textarea
                        className="pmg-cg-input"
                        value={form[name]}
                        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
                        placeholder={placeholder}
                        rows={3}
                    />
                ) : (
                    <input
                        className="pmg-cg-input"
                        value={form[name]}
                        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
                        placeholder={placeholder}
                    />
                )
            }
        </div>
    );
}