import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export default function ImagePreview({ images = [], initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex];
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `${baseUrl}${currentImage.url}`;
    link.download = currentImage.originalName || `image-${currentIndex + 1}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -right-4 -top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-gray-600 shadow-lg hover:bg-gray-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-600 shadow-lg hover:bg-white"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-600 shadow-lg hover:bg-white"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Main Image */}
        <div className="relative">
          <img
            src={`${baseUrl}${currentImage.url}`}
            alt={currentImage.originalName || `Image ${currentIndex + 1}`}
            className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNkM5Ljc5IDEzLjc5IDkuNzkgMTAuMjEgMTIgOEMxNC4yMSAxMC4yMSAxNC4yMSAxMy43OSAxMiAxNloiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
            }}
          />
        </div>

        {/* Image Info & Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {currentImage.originalName || `รูปภาพ ${currentIndex + 1}`}
              </p>
              {images.length > 1 && (
                <p className="text-xs text-white/80">
                  {currentIndex + 1} จาก {images.length}
                </p>
              )}
              {currentImage.size && (
                <p className="text-xs text-white/60">
                  {(currentImage.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-2 text-sm font-medium backdrop-blur-sm hover:bg-white/30"
            >
              <Download className="h-4 w-4" />
              ดาวน์โหลด
            </button>
          </div>
        </div>

        {/* Thumbnail Navigation */}
        {images.length > 1 && (
          <div className="absolute -bottom-20 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/90 p-2 shadow-lg backdrop-blur-sm">
            {images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => setCurrentIndex(index)}
                className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition-all ${
                  index === currentIndex 
                    ? 'border-blue-500 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={`${baseUrl}${image.url}`}
                  alt={`Thumbnail ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}