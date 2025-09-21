export interface SendGridTemplateVersion {
  id: string;
  template_id: string;
  active: number;
  name: string;
  html_content: string;
  plain_content: string;
  generate_plain_content: boolean;
  subject: string;
  updated_at: string;
  editor: string;
  test_data: string;
}

export interface SendGridTemplate {
  id: string;
  name: string;
  generation: string;
  updated_at: string;
  versions: SendGridTemplateVersion[];
}
