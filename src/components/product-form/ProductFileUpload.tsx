
import React from 'react';
import { Label } from '@/components/ui/label';
import { Upload, X } from 'lucide-react';

interface ProductFileUploadProps {
  images: File[];
  files: File[];
  productType: 'physical' | 'digital' | 'service';
  onImageChange: (files: FileList | null) => void;
  onFileChange: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onRemoveFile: (index: number) => void;
}

export const ProductFileUpload: React.FC<ProductFileUploadProps> = ({
  images,
  files,
  productType,
  onImageChange,
  onFileChange,
  onRemoveImage,
  onRemoveFile
}) => {
  // Services don't need file uploads typically
  if (productType === 'service') {
    return (
      <div className="space-y-6">
        {/* Product Images - Optional for services */}
        <div className="space-y-3">
          <Label>Service Images (Optional)</Label>
          <p className="text-sm text-gray-500">Add images to showcase your service</p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onImageChange(e.target.files)}
              className="hidden"
              id="service-images"
            />
            <label htmlFor="service-images" className="cursor-pointer">
              <div className="text-center">
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-600">Click to upload service images</p>
                <p className="text-sm text-gray-500">PNG, JPG up to 10MB each</p>
              </div>
            </label>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {images.map((file, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Product Images */}
      <div className="space-y-3">
        <Label>Product Images</Label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onImageChange(e.target.files)}
            className="hidden"
            id="images"
          />
          <label htmlFor="images" className="cursor-pointer">
            <div className="text-center">
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-600">Click to upload images</p>
              <p className="text-sm text-gray-500">PNG, JPG up to 10MB each</p>
            </div>
          </label>
        </div>
        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {images.map((file, index) => (
              <div key={index} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digital Files (only for digital products) */}
      {productType === 'digital' && (
        <div className="space-y-3">
          <Label>Digital Files *</Label>
          <p className="text-sm text-gray-500">Upload the files customers will download</p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input
              type="file"
              multiple
              onChange={(e) => onFileChange(e.target.files)}
              className="hidden"
              id="files"
            />
            <label htmlFor="files" className="cursor-pointer">
              <div className="text-center">
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-600">Upload digital files</p>
                <p className="text-sm text-gray-500">Any file type, up to 100MB each</p>
              </div>
            </label>
          </div>
          {files.length > 0 && (
            <div className="space-y-3 mt-4">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <span className="font-medium">{file.name}</span>
                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
