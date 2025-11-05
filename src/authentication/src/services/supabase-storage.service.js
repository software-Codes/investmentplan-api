const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

class SupabaseStorageService {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || `https://dfzasfyacaoruebpjzof.supabase.co`;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    console.log('Supabase config:', { 
      url: supabaseUrl, 
      keyLength: supabaseKey?.length,
      keyPrefix: supabaseKey?.substring(0, 20)
    });
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    this.bucketName = 'kyc-documents';
  }

  async uploadDocument({ userId, documentType, fileBuffer, fileName, contentType }) {
    try {
      console.log('Uploading to Supabase:', { userId, documentType, fileName, contentType });
      
      // Check if bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      console.log('Available buckets:', buckets?.map(b => b.name));
      
      const fileExt = fileName.split('.').pop();
      const uniqueFileName = `${userId}/${documentType}_${uuidv4()}.${fileExt}`;

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, fileBuffer, {
          contentType,
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error:', JSON.stringify(error, null, 2));
        throw error;
      }

      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      console.log('Upload successful:', data.path);

      return {
        blobStoragePath: data.path,
        blobStorageUrl: urlData.publicUrl,
        fileName: uniqueFileName,
        originalFileName: fileName
      };
    } catch (error) {
      console.error('Storage service error:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  async uploadProfilePhoto({ userId, fileBuffer, fileName, contentType }) {
    try {
      const bucketName = 'profile-photos';
      const fileExt = fileName.split('.').pop();
      const uniqueFileName = `${userId}/profile_${Date.now()}.${fileExt}`;

      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(uniqueFileName, fileBuffer, {
          contentType,
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(uniqueFileName);

      return {
        filePath: data.path,
        publicUrl: urlData.publicUrl
      };
    } catch (error) {
      throw new Error(`Profile photo upload failed: ${error.message}`);
    }
  }

  async deleteDocument(filePath) {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) throw error;
      return true;
    } catch (error) {
      throw new Error(`Document deletion failed: ${error.message}`);
    }
  }
}

module.exports = SupabaseStorageService;
