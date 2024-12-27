import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css'],
})
export class FileUploadComponent implements OnInit {
  files: {
    file: File;
    name: string;
    progress: number;
    uploaded: boolean;
    error?: string;
    previewUrl?: string;
    tempPath?: string; // Store the temporary path of the file
  }[] = [];

  capturedImages: {
    file: File;
    name: string;
    previewUrl: string;
  }[] = [];

  uploading = false;
  maxFiles = 5;
  maxCapturedImages = 7; // Limit for captured images

  errorMessage: string | null = null;
  finalUploadInProgress = false; // Flag to track final upload progress
  globalProgress = 0; // Global progress for final upload
  canFinalize = false; // Flag to show "Final Upload" button

  isCameraOpen = false;
  capturedImage: string | null = null;
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    Array.from(input.files).forEach((file) => {
      const isValidType =
        file.type === 'image/png' ||
        file.type === 'image/jpeg' ||
        file.type === 'application/pdf';
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB

      if (this.files.length < this.maxFiles) {
        if (isValidType && isValidSize) {
          const reader = new FileReader();
          reader.onload = () => {
            this.files.push({
              file,
              name: file.name,
              progress: 0,
              uploaded: false,
              previewUrl: reader.result as string, // Use the FileReader result as preview
            });
          };
          reader.readAsDataURL(file); // Read the file for preview
        } else {
          const error = isValidType
            ? 'File size exceeds 5 MB.'
            : 'Invalid file type. Only images and PDFs are allowed.';
          this.files.push({
            file,
            name: file.name,
            progress: 0,
            uploaded: false,
            error,
          });
        }
      } else {
        this.errorMessage =
          'You can only upload up to 5 files. Please remove extra files.';
      }
    });

    // Clear the input field after selecting files
    input.value = '';
    this.checkFinalizeUpload(); // Check the condition for "Final Upload" button
  }

  uploadFiles() {
    this.uploading = true;
    this.files.forEach((fileEntry, index) => {
      if (fileEntry.error) return;

      const formData = new FormData();
      formData.append('file', fileEntry.file);

      this.http
        .post<{ success: boolean; tempPath: string }>(
          'http://localhost:3000/temp-upload',
          formData,
          {
            reportProgress: true,
            observe: 'events',
          }
        )
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              fileEntry.progress = Math.round(
                (100 * event.loaded) / event.total
              );
            } else if (
              event.type === HttpEventType.Response &&
              event.body?.success
            ) {
              fileEntry.uploaded = true;
              fileEntry.tempPath = event.body.tempPath; // Store the tempPath
            }
          },
          error: () => {
            fileEntry.error = 'Failed to upload file.';
          },
          complete: () => {
            this.checkFinalizeUpload(); // Recheck if the "Final Upload" button should be shown
            if (this.files.every((file) => file.uploaded || file.error)) {
              // After all files are uploaded temporarily, enable the 'Final Upload' button
              this.uploading = false;
            }
          },
        });
    });
  }

  checkFinalizeUpload() {
    this.canFinalize = this.files.every((file) => file.uploaded && !file.error);
  }

  finalUpload() {
    this.finalUploadInProgress = true;
    this.globalProgress = 0;

    const tempPaths = this.files
      .filter((file) => file.tempPath && !file.error)
      .map((file) => file.tempPath);

    if (tempPaths.length > 0) {
      this.http
        .post<{ success: boolean; finalPaths: string[] }>(
          'http://localhost:3000/final-upload',
          { tempPaths },
          {
            observe: 'events',
          }
        )
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              this.globalProgress = Math.round(
                (100 * event.loaded) / event.total
              );
            } else if (
              event.type === HttpEventType.Response &&
              event.body?.success
            ) {
              this.files.forEach((fileEntry) => {
                if (fileEntry.tempPath) {
                  fileEntry.uploaded = true;
                }
              });
              this.finalUploadInProgress = false;
              this.files = [];
            }
          },
          error: () => {
            this.errorMessage = 'Failed to move files to the final directory.';
            this.finalUploadInProgress = false;
          },
        });
    }
  }

  cancelUpload(fileEntry: any) {
    this.files = this.files.filter((file) => file !== fileEntry);
    this.checkFinalizeUpload();
  }

  isUploadDisabled(): boolean {
    return (
      this.files.length === 0 ||
      this.files.some((file) => file.error) ||
      this.files.length > this.maxFiles ||
      this.uploading ||
      this.finalUploadInProgress
    );
  }

  openCamera() {
    this.isCameraOpen = true;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        this.videoElement.nativeElement.srcObject = stream;
      })
      .catch((err) => {
        console.error('Error accessing camera: ', err);
        alert('Error accessing the camera');
      });
  }

  captureImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        this.videoElement.nativeElement,
        0,
        0,
        canvas.width,
        canvas.height
      );
      this.capturedImage = canvas.toDataURL('image/png');

      if (this.capturedImages.length < this.maxCapturedImages) {
        // Convert data URL to a File object
        const file = this.dataURLToFile(
          this.capturedImage,
          `captured-image-${Date.now()}.png`
        );

        this.capturedImages.push({
          file,
          name: file.name,
          previewUrl: this.capturedImage,
        });
      } else {
        alert(`You can only capture up to ${this.maxCapturedImages} images.`);
      }

      // Create a new file entry and push it into the files array
      // const reader = new FileReader();
      // reader.onload = () => {
      //   this.files.push({
      //     file,
      //     name: file.name,
      //     progress: 0,
      //     uploaded: false,
      //     previewUrl: reader.result as string,
      //   });
      // };
      // reader.readAsDataURL(file); // Read the file for preview
    }
  }

  addCapturedImagesToUpload() {
    this.capturedImages.forEach((capturedImage) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.files.push({
          file: capturedImage.file,
          name: capturedImage.name,
          progress: 0,
          uploaded: false,
          previewUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(capturedImage.file);
    });
    this.capturedImages = []; // Clear the captured images after adding them to upload files
    this.checkFinalizeUpload(); // Check if the "Final Upload" button should be enabled
  }

  /**
   * Converts a data URL to a File object.
   * @param dataurl The data URL to convert.
   * @param filename The name of the file.
   * @returns A File object.
   */
  dataURLToFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  cancelCapture() {
    this.isCameraOpen = false;
    this.capturedImage = null;
  }

  cancelCapturedImage(index: number) {
    this.capturedImages.splice(index, 1);
  }
}
