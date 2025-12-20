import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Eye } from 'lucide-react';
import ImagePreview from './ImagePreview';

export default function ImageUpload({ 
  images = [], 
  onUpload, 
  onDelete, 
  maxImages = 5,
  disabled = false 
}) {
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // ตรวจสอบจำนวนรูปภาพสูงสุด
    if (images.length + files.length > maxImages) {
      alert(`สามารถอัปโหลดได้สูงสุด ${maxImages} รูป`);
      return;
    }

    // ตรวจสอบขนาดไฟล์
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    setUploading(true);
    try {
      await onUpload(files);
    } catch (error) {
      console.error('Upload error:', error);
      alert('ไม่สามารถอัปโหลดรูปภาพได้');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (imageId) => {
    if (window.confirm('ต้องการลบรูปภาพนี้หรือไม่?')) {
      try {
        await onDelete(imageId);
      } catch (error) {
        console.error('Delete error:', error);
        alert('ไม่สามารถลบรูปภาพได้');
      }
    }
  };

  const handlePreview = (index) => {
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      {images.length < maxImages && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'กำลังอัปโหลด...' : 'เพิ่มรูปภาพ'}
          </button>
          <p className="mt-1 text-xs text-gray-500">
            รองรับ JPG, PNG, GIF, WebP (สูงสุด 5MB, {maxImages} รูป)
          </p>
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="group relative">
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 cursor-pointer">
                <img
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${image.url}`}
                  alt={image.originalName || 'Warranty image'}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  onClick={() => handlePreview(index)}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNkM5Ljc5IDEzLjc5IDkuNzkgMTAuMjEgMTIgOEMxNC4yMSAxMC4yMSAxNC4yMSAxMy43OSAxMiAxNloiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
                  }}
                />
                
                {/* Preview Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Eye className="h-6 w-6 text-white" />
                </div>
              </div>
              
              {/* Delete Button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              
              {/* Image Info */}
              <div className="mt-1">
                <p className="truncate text-xs text-gray-500" title={image.originalName}>
                  {image.originalName}
                </p>
                {image.size && (
                  <p className="text-xs text-gray-400">
                    {(image.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-8 text-gray-500">
          <ImageIcon className="h-8 w-8 mb-2" />
          <p className="text-sm">ยังไม่มีรูปภาพ</p>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewOpen && (
        <ImagePreview
          images={images}
          initialIndex={previewIndex}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}