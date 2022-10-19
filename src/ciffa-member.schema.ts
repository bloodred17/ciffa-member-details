import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

export class Contact {
  @prop()
  phone: string;

  @prop()
  email: string;

  constructor(init: Partial<Contact>) {
    Object.assign(this, init);
  }
}

@modelOptions({ schemaOptions: { collection: 'ciffa_members' } })
export class CiffaMember {
  @prop()
  company_name: string;

  @prop()
  carrier_code: string;

  @prop()
  location: string;

  @prop({ _id: false })
  contact: Contact;

  @prop()
  is_freight_forwarder: boolean;

  constructor(init: Partial<CiffaMember>) {
    Object.assign(this, init);
  }

  static get model() {
    return getModelForClass(CiffaMember);
  }
}
