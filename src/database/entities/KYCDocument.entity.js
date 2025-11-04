const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'KYCDocument',
  tableName: 'kyc_documents',
  columns: {
    document_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    user_id: {
      type: 'uuid',
      nullable: false
    },
    document_type: {
      type: 'enum',
      enum: ['national_id', 'drivers_license', 'passport'],
      nullable: false
    },
    document_country: {
      type: 'varchar',
      length: 100,
      nullable: true
    },
    verification_reference: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    blob_storage_path: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    blob_storage_url: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    file_name: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    original_file_name: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    file_size: {
      type: 'integer',
      nullable: true
    },
    file_type: {
      type: 'varchar',
      length: 100,
      nullable: true
    },
    uploaded_at: {
      type: 'timestamptz',
      nullable: false
    },
    created_at: {
      type: 'timestamptz',
      nullable: false
    },
    updated_at: {
      type: 'timestamptz',
      nullable: false
    }
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'user_id' },
      onDelete: 'CASCADE'
    }
  },
  indices: [
    { columns: ['verification_reference'] }
  ]
});
