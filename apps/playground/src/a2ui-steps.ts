import type { A2UIForm } from '@continuum/adapters';

export type A2UIStep = {
  label: string;
  description: string;
  form: A2UIForm;
};

export const a2uiSteps: A2UIStep[] = [
  {
    label: 'Step 1: Personal Info (A2UI)',
    description: 'AI generates initial loan application form via A2UI protocol',
    form: {
      id: 'loan-app',
      version: '1.0',
      fields: [
        { name: 'first_name', type: 'TextInput', label: 'First Name' },
        { name: 'last_name', type: 'TextInput', label: 'Last Name' },
        { name: 'email', type: 'TextInput', label: 'Email' },
        { name: 'agree_terms', type: 'Switch', label: 'Agree to Terms' },
      ],
    },
  },
  {
    label: 'Step 2: Expanded Fields (A2UI)',
    description: 'AI adds date of birth, phone, and a notes field via A2UI',
    form: {
      id: 'loan-app',
      version: '2.0',
      fields: [
        { name: 'first_name', type: 'TextInput', label: 'First Name' },
        { name: 'last_name', type: 'TextInput', label: 'Last Name' },
        { name: 'email', type: 'TextInput', label: 'Email' },
        { name: 'phone', type: 'TextInput', label: 'Phone Number' },
        { name: 'dob', type: 'DateInput', label: 'Date of Birth' },
        { name: 'notes', type: 'TextArea', label: 'Additional Notes' },
        { name: 'agree_terms', type: 'Switch', label: 'Agree to Terms' },
      ],
    },
  },
  {
    label: 'Step 3: Structured Sections (A2UI)',
    description: 'AI organizes fields into sections and adds a dropdown',
    form: {
      id: 'loan-app',
      version: '3.0',
      fields: [
        {
          name: 'personal_info',
          type: 'Section',
          label: 'Personal Information',
          fields: [
            { name: 'first_name', type: 'TextInput', label: 'First Name' },
            { name: 'last_name', type: 'TextInput', label: 'Last Name' },
            { name: 'email', type: 'TextInput', label: 'Email' },
            { name: 'dob', type: 'DateInput', label: 'Date of Birth' },
          ],
        },
        {
          name: 'loan_details',
          type: 'Section',
          label: 'Loan Details',
          fields: [
            {
              name: 'loan_type',
              type: 'Dropdown',
              label: 'Loan Type',
              options: [
                { id: 'personal', label: 'Personal Loan' },
                { id: 'mortgage', label: 'Mortgage' },
                { id: 'auto', label: 'Auto Loan' },
              ],
            },
            { name: 'notes', type: 'TextArea', label: 'Additional Notes' },
          ],
        },
        { name: 'agree_terms', type: 'Switch', label: 'Agree to Terms' },
      ],
    },
  },
  {
    label: 'Step 4: Type Changes (A2UI)',
    description: 'AI converts loan_type from dropdown to selection input, removes notes',
    form: {
      id: 'loan-app',
      version: '4.0',
      fields: [
        {
          name: 'personal_info',
          type: 'Section',
          label: 'Personal Information',
          fields: [
            { name: 'first_name', type: 'TextInput', label: 'First Name' },
            { name: 'last_name', type: 'TextInput', label: 'Last Name' },
            { name: 'email', type: 'TextInput', label: 'Email' },
            { name: 'dob', type: 'DateInput', label: 'Date of Birth' },
          ],
        },
        {
          name: 'loan_details',
          type: 'Section',
          label: 'Loan Details',
          fields: [
            {
              name: 'loan_type',
              type: 'SelectionInput',
              label: 'Loan Type',
              options: [
                { id: 'personal', label: 'Personal Loan' },
                { id: 'mortgage', label: 'Mortgage' },
                { id: 'auto', label: 'Auto Loan' },
                { id: 'student', label: 'Student Loan' },
              ],
            },
            {
              name: 'employment',
              type: 'Dropdown',
              label: 'Employment Status',
              options: [
                { id: 'employed', label: 'Employed' },
                { id: 'self-employed', label: 'Self-Employed' },
                { id: 'retired', label: 'Retired' },
              ],
            },
          ],
        },
        { name: 'agree_terms', type: 'Toggle', label: 'Agree to Terms' },
      ],
    },
  },
  {
    label: 'Step 5: Final Review (A2UI)',
    description: 'AI simplifies to a final review form, removes employment',
    form: {
      id: 'loan-app',
      version: '5.0',
      fields: [
        { name: 'first_name', type: 'TextInput', label: 'First Name' },
        { name: 'last_name', type: 'TextInput', label: 'Last Name' },
        { name: 'email', type: 'TextInput', label: 'Email' },
        {
          name: 'loan_type',
          type: 'Dropdown',
          label: 'Loan Type',
          options: [
            { id: 'personal', label: 'Personal Loan' },
            { id: 'mortgage', label: 'Mortgage' },
            { id: 'auto', label: 'Auto Loan' },
          ],
        },
        { name: 'agree_terms', type: 'Switch', label: 'Agree to Terms' },
      ],
    },
  },
];
