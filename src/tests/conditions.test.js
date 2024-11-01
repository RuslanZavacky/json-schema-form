import set from 'lodash/set';

import { createHeadlessForm } from '../createHeadlessForm';

// Copy-pasted from https://codesandbox.io/p/sandbox/json-schema-form-demo-react-igh3sk?file=%2Fsrc%2Futils.js
function formValuesToJsonValues(fields, values) {
  const fieldTypeTransform = {
    number: (val) => (val === '' ? val : +val),
    text: (val) => val,
    // TODO support all types
  };

  const jsonValues = {};

  fields.forEach(({ name, type, isVisible }) => {
    const formValue = values[name];
    const transformedValue = fieldTypeTransform[type]?.(formValue) || formValue;

    if (transformedValue === '') {
      // Omit empty fields from payload to avoid type error.
      // eg { team_size: "" } -> The value ("") must be a number.
    } else if (!isVisible) {
      // Omit invisible (conditional) fields to avoid error:
      // eg { account: "personal", team_size: 3 } -> The "team_size" is invalid
    } else {
      set(jsonValues, name, transformedValue);
    }
  });

  return jsonValues;
}

it('Should allow check of a nested property in a conditional', () => {
  const { handleValidation } = createHeadlessForm(
    {
      additionalProperties: false,
      allOf: [
        {
          if: {
            properties: {
              parent: {
                properties: {
                  child: {
                    const: 'yes',
                  },
                },
                required: ['child'],
              },
            },
            required: ['parent'],
          },
          then: { required: ['parent_sibling'] },
        },
      ],
      properties: {
        parent: {
          additionalProperties: false,
          properties: {
            child: {
              oneOf: [{ const: 'yes' }, { const: 'no' }],
              type: 'string',
            },
          },
          required: ['child'],
          type: 'object',
        },
        parent_sibling: {
          type: 'integer',
        },
      },
      required: ['parent'],
      type: 'object',
    },
    { strictInputType: false }
  );
  expect(handleValidation({ parent: { child: 'no' } }).formErrors).toEqual(undefined);
  expect(handleValidation({ parent: { child: 'yes' } }).formErrors).toEqual({
    parent_sibling: 'Required field',
  });
  expect(handleValidation({ parent: { child: 'yes' }, parent_sibling: 1 }).formErrors).toEqual(
    undefined
  );
});

describe('Conditional attributes updated', () => {
  it('Update basic case with const, default, maximum', () => {
    const { fields, handleValidation } = createHeadlessForm(
      {
        properties: {
          is_full_time: { type: 'string', oneOf: [{ const: 'yes' }, { const: 'no' }] },
          hours: { type: 'number' },
        },
        allOf: [
          {
            if: {
              properties: { is_full_time: { const: 'yes' } },
              required: ['is_full_time'],
            },
            then: {
              properties: {
                hours: {
                  const: 8,
                  default: 8,
                },
              },
            },
            else: {
              properties: {
                hours: {
                  maximum: 4,
                },
              },
            },
          },
        ],
      },
      { strictInputType: false }
    );

    // Given "Yes" it applies "const" and "default"
    expect(handleValidation({ is_full_time: 'yes', hours: 4 }).formErrors).toEqual({
      hours: 'The only accepted value is 8.',
    });
    expect(fields[1]).toMatchObject({ const: 8, default: 8 });
    expect(fields[1].maximum).toBeUndefined();

    // Changing to "No", applies the "maximum" and cleans "const" and "default"
    expect(handleValidation({ is_full_time: 'no', hours: 4 }).formErrors).toBeUndefined();
    expect(fields[1]).toMatchObject({ maximum: 4 });
    expect(fields[1].const).toBeUndefined();
    expect(fields[1].default).toBeUndefined();

    // Changing back to "Yes", it removes "maximum", and applies "const" and "default"
    expect(handleValidation({}).formErrors).toBeUndefined();
    expect(handleValidation({ is_full_time: 'yes', hours: 8 }).formErrors).toBeUndefined();
    expect(fields[1].maximum).toBeUndefined();
    expect(fields[1]).toMatchObject({ const: 8, default: 8 });
  });

  it('Update a new attribute (eg description)', () => {
    const { fields, handleValidation } = createHeadlessForm(
      {
        properties: {
          is_full_time: { type: 'string', oneOf: [{ const: 'yes' }, { const: 'no' }] },
          hours: {
            type: 'number',
          },
        },
        allOf: [
          {
            if: {
              properties: { is_full_time: { const: 'yes' } },
              required: ['is_full_time'],
            },
            then: {
              properties: {
                hours: {
                  description: 'We recommend 8 hours.',
                },
              },
            },
          },
        ],
      },
      { strictInputType: false }
    );

    // By default the attribute is not set.
    expect(fields[1].description).toBeUndefined();

    // Given "Yes" it applies the conditional attribute
    expect(handleValidation({ is_full_time: 'yes' }).formErrors).toBeUndefined();
    expect(fields[1].description).toBe('We recommend 8 hours.');

    // Changing to "No", removes the description
    expect(handleValidation({ is_full_time: 'no' }).formErrors).toBeUndefined();
    expect(fields[1].description).toBeUndefined();

    // Changing back to "Yes", it sets the attribute again
    expect(handleValidation({ is_full_time: 'yes' }).formErrors).toBeUndefined();
    expect(fields[1].description).toBe('We recommend 8 hours.');
  });

  it('Update an existing attribute (eg description)', () => {
    const { fields, handleValidation } = createHeadlessForm(
      {
        properties: {
          is_full_time: { type: 'string', oneOf: [{ const: 'yes' }, { const: 'no' }] },
          hours: {
            type: 'number',
            description: 'Any value works.',
          },
        },
        allOf: [
          {
            if: {
              properties: { is_full_time: { const: 'yes' } },
              required: ['is_full_time'],
            },
            then: {
              properties: {
                hours: {
                  description: 'We recommend 8 hours.',
                },
              },
            },
          },
        ],
      },
      { strictInputType: false }
    );

    // By default the attribute is set the base value.
    expect(fields[1].description).toBe('Any value works.');

    // Given "Yes" it applies the conditional attribute
    expect(handleValidation({ is_full_time: 'yes', hours: 4 }).formErrors).toBeUndefined();
    expect(fields[1].description).toBe('We recommend 8 hours.');

    // Changing to "No", it applies the base value again.
    expect(handleValidation({ is_full_time: 'no', hours: 4 }).formErrors).toBeUndefined();
    expect(fields[1].description).toBe('Any value works.');

    // Changing back to "Yes", it sets the attribute again
    expect(handleValidation({ is_full_time: 'yes', hours: 8 }).formErrors).toBeUndefined();
    expect(fields[1].description).toBe('We recommend 8 hours.');
  });

  it('Update a nested attribute', () => {
    const { fields, handleValidation } = createHeadlessForm(
      {
        properties: {
          is_full_time: { type: 'string', oneOf: [{ const: 'yes' }, { const: 'no' }] },
          hours: {
            type: 'number',
            presentation: {
              inputType: 'number',
              anything: 'info',
            },
          },
        },
        allOf: [
          {
            if: {
              properties: { is_full_time: { const: 'yes' } },
              required: ['is_full_time'],
            },
            then: {
              properties: {
                hours: {
                  presentation: {
                    anything: 'danger',
                  },
                },
              },
            },
          },
        ],
      },
      { strictInputType: false }
    );

    // By default the attribute is set the base value.
    expect(fields[1].anything).toBe('info');

    // Given "Yes" it applies the conditional attribute
    expect(handleValidation({ is_full_time: 'yes' }).formErrors).toBeUndefined();
    expect(fields[1].anything).toBe('danger');

    // Changing to "No", it applies the base value again.
    expect(handleValidation({ is_full_time: 'no' }).formErrors).toBeUndefined();
    expect(fields[1].anything).toBe('info');

    // Changing back to "Yes", it sets the attribute again
    expect(handleValidation({ is_full_time: 'yes' }).formErrors).toBeUndefined();
    expect(fields[1].anything).toBe('danger');
  });

  it('Keeps existing attributes in matches that dont change the attr', () => {
    const { fields, handleValidation } = createHeadlessForm(
      {
        properties: {
          is_full_time: { type: 'string', oneOf: [{ const: 'yes' }, { const: 'no' }] },
          hours: {
            type: 'number',
            description: 'Any value works.',
          },
        },
        allOf: [
          {
            if: {
              properties: { is_full_time: { const: 'yes' } },
              required: ['is_full_time'],
            },
            then: {
              required: ['hours'],
            },
            else: {
              properties: {
                hours: false,
              },
            },
          },
        ],
      },
      { strictInputType: false }
    );

    // By default the attribute is set the base value, even though the field is invisible.
    expect(fields[1].description).toBe('Any value works.');
    expect(fields[1].isVisible).toBe(false);

    // Given "Yes" it keeps the base value
    expect(handleValidation({ is_full_time: 'yes' }).formErrors).toEqual({
      hours: 'Required field',
    });
    expect(fields[1].description).toBe('Any value works.');
    expect(fields[1].isVisible).toBe(true);

    // Changing to "No" it keeps the base value
    expect(handleValidation({ is_full_time: 'no' }).formErrors).toBeUndefined();
    expect(fields[1].description).toBe('Any value works.');
    expect(fields[1].isVisible).toBe(false);
  });

  it('Keeps internal attributes (dynamicInternalJsfAttrs)', () => {
    // This is necessary while we keep supporting "type", even if deprecated
    // otherwise our Remote app will break because it didn't migrate
    // from "type" to "inputType" yet.
    const { fields, handleValidation } = createHeadlessForm(
      {
        properties: {
          is_full_time: { type: 'string', oneOf: [{ const: 'yes' }, { const: 'no' }] },
          salary_period: {
            type: 'string',
            title: 'Salary period',
            oneOf: [
              { title: 'Weekly', const: 'weekly' },
              { title: 'Monthly', const: 'monthly' },
            ],
          },
        },
        allOf: [
          {
            if: {
              properties: { is_full_time: { const: 'yes' } },
              required: ['is_full_time'],
            },
            then: {
              properties: {
                salary_period: {
                  description: 'We recommend montlhy.',
                },
              },
            },
          },
        ],
      },
      { strictInputType: false }
    );

    // Given "Yes" it keeps the "type"
    handleValidation({ is_full_time: 'yes' });

    // All the following attrs are never removed
    // during conditionals because they are core.
    expect(fields[1]).toMatchObject({
      name: 'salary_period',
      label: 'Salary period',
      required: false,
      type: 'radio',
      inputType: 'radio',
      jsonType: 'string',
      computedAttributes: {},
      calculateConditionalProperties: expect.any(Function),
      schema: expect.any(Object),
      scopedJsonSchema: expect.any(Object),
      isVisible: true,
      options: [
        {
          label: 'Weekly',
          value: 'weekly',
        },
        {
          label: 'Monthly',
          value: 'monthly',
        },
      ],
    });
  });

  it('Keeps custom attributes (dynamicInternalJsfAttrs) (hotfix temporary)', () => {
    // This is necessary as hotfix because we (Remote) use it internally.
    // Not cool, we'll need a better solution asap.
    const { fields, handleValidation } = createHeadlessForm(
      {
        properties: {
          is_full_time: { type: 'string', oneOf: [{ const: 'yes' }, { const: 'no' }] },
          salary_period: {
            type: 'string',
            title: 'Salary period',
            oneOf: [
              { title: 'Weekly', const: 'weekly' },
              { title: 'Monthly', const: 'monthly' },
            ],
          },
        },
        allOf: [
          {
            if: {
              properties: { is_full_time: { const: 'yes' } },
              required: ['is_full_time'],
            },
            then: {
              properties: {
                salary_period: {
                  description: 'We recommend montlhy.',
                },
              },
            },
          },
        ],
      },
      {
        strictInputType: false,
        customProperties: {
          salary_period: {
            Component: '<A React Component>',
            calculateDynamicProperties: () => true,
          },
        },
      }
    );

    // It's there by default
    expect(fields[1].Component).toBe('<A React Component>');
    expect(fields[1].calculateDynamicProperties).toEqual(expect.any(Function));

    // Given "Yes", it stays there too.
    handleValidation({ is_full_time: 'yes' });
    expect(fields[1].Component).toBe('<A React Component>');
    expect(fields[1].calculateDynamicProperties).toEqual(expect.any(Function));

    // Given "No", it stays there too.
    handleValidation({ is_full_time: 'no' });
    expect(fields[1].Component).toBe('<A React Component>');
    expect(fields[1].calculateDynamicProperties).toEqual(expect.any(Function));

    expect(fields[1].visibilityCondition).toEqual(undefined);
    // visibilityCondition can be externally changed/updated/added, it stays there too;
    fields[1].visibilityCondition = () => false;
    handleValidation({ is_full_time: 'no' });
    expect(fields[1].visibilityCondition).toEqual(expect.any(Function));
  });
});

describe('Conditional with a minimum value check', () => {
  it('Should handle a maximum as a property field check', () => {
    const schema = {
      additionalProperties: false,
      allOf: [
        {
          if: {
            properties: {
              salary: {
                maximum: 119999,
              },
            },
            required: ['salary'],
          },
          then: {
            required: ['reason'],
          },
          else: {
            properties: {
              reason: false,
            },
          },
        },
      ],
      properties: {
        salary: {
          type: 'number',
          'x-jsf-presentation': {
            inputType: 'money',
          },
        },
        reason: {
          oneOf: [
            {
              const: 'reason_one',
            },
            {
              const: 'reason_two',
            },
          ],
          type: 'string',
        },
      },
      required: ['salary'],
      type: 'object',
    };

    const { handleValidation } = createHeadlessForm(schema, { strictInputType: false });
    expect(handleValidation({ salary: 120000 }).formErrors).toEqual(undefined);
    expect(handleValidation({ salary: 1000 }).formErrors).toEqual({
      reason: 'Required field',
    });
    expect(handleValidation({ salary: 1000, reason: 'reason_one' }).formErrors).toEqual(undefined);
  });
});

describe('Conditional with fields that depend on the previous value', () => {
  it('Should hide dependent field if value does not satisfy conditional anymore', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        has_pet: {
          title: 'Has Pet',
          description: 'Do you have a pet?',
          oneOf: [
            {
              title: 'Yes',
              const: 'yes',
            },
            {
              title: 'No',
              const: 'no',
            },
          ],
          'x-jsf-presentation': {
            inputType: 'radio',
          },
          type: 'string',
        },
        pet_name: {
          title: "Pet's name",
          description: "What's your pet's name?",
          'x-jsf-presentation': {
            inputType: 'text',
          },
          type: 'string',
        },
        pet_age: {
          title: "Pet's age",
          description: "What's your pet's age",
          'x-jsf-presentation': {
            inputType: 'number',
          },
          type: 'number',
        },
        dietary_needs: {
          title: 'Dietary needs',
          description: "What are your pet's dietary needs?",
          'x-jsf-presentation': {
            inputType: 'textarea',
          },
          type: 'string',
        },
      },
      required: ['has_pet'],
      'x-jsf-order': ['has_pet', 'pet_name', 'pet_age', 'dietary_needs'],
      allOf: [
        {
          if: {
            properties: {
              has_pet: {
                const: 'yes',
              },
            },
            required: ['has_pet'],
          },
          then: {
            required: ['pet_age', 'pet_name'],
          },
          else: {
            properties: {
              pet_age: false,
              pet_name: false,
              dietary_needs: false,
            },
          },
        },
        {
          if: {
            properties: {
              pet_age: {
                minimum: 5,
              },
            },
            required: ['pet_age'],
          },
          then: {
            required: ['dietary_needs'],
          },
          else: {
            properties: {
              dietary_needs: false,
            },
          },
        },
      ],
    };

    const { fields, handleValidation } = createHeadlessForm(schema, { strictInputType: false });

    let result = handleValidation({});

    // Step 1: Click on Submit without any form interaction
    expect(result.formErrors).toEqual({ has_pet: 'Required field' });
    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: false');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: false');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: false');

    // Step 2: Specify that you have a pet, form shows Pet name and age. Enter Name, skip adding age.
    result = handleValidation({ has_pet: 'yes', pet_name: 'Woofy' });

    expect(result.formErrors).toEqual({ pet_age: 'Required field' });

    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: true');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: true');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: false');

    // Step 3: Set age to be 6, to show dietary needs
    result = handleValidation({ has_pet: 'yes', pet_name: 'Woofy', pet_age: 6 });

    expect(result.formErrors).toEqual({ dietary_needs: 'Required field' });

    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: true');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: true');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: true');

    // Step 3: Change radio for Has pet to be "no". Form should be valid and
    // pet_name, pet_age and dietary_needs to be hidden

    const formValues = {
      has_pet: 'no',
      pet_name: 'Woofy',
      pet_age: 6,
    };

    // 📌📌📌📌📌📌📌📌
    // NEW: Bug explanation: In the Playground (React), when changing values,
    // the validation is called twice (re-renders), that's why it works.
    // Let me break down the data flow for you:

    // 📌 1st validation round:
    // At this point, pet_name is still isVisible, that's why pet_age is not trimmed...
    const jsonValuesFirst = formValuesToJsonValues(fields, formValues);
    expect(jsonValuesFirst).toEqual({
      has_pet: 'no',
      pet_name: 'Woofy',
      pet_age: 6,
    });
    // The validation will now turn pet_age invisible because of has_pet: 'no' above.
    // But dietary_needs is still visibile (required) because of pet_age: 6 above.
    result = handleValidation(jsonValuesFirst);

    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: false');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: true');

    // 📌 2nd validation round:
    // At this point as "pet_age" is invisible, the age gets trimmed.
    const jsonValuesSecond = formValuesToJsonValues(fields, formValues);
    expect(jsonValuesSecond).toEqual({
      has_pet: 'no',
    });
    // ...and when running the validation again, dietary_needs becomes invisible too (not required).
    result = handleValidation(jsonValuesSecond);

    expect(result.formErrors).toEqual(undefined);

    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: false');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: false');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: false');

    /* CONCLUSION:
     You found a tricky bug that we never realized because of our internal React app lifecycle.
     Fun fact: If you try it in the Codesandbox demo, the bug happens there too. 😅
     How would we fix it? I don't know, we'd need time to investigate.
     It's quite tricky because the formValuesToJsonValues() takes into account
     the existing field state, not the new one.

     For now, the workaround is to call the validation twice, like this:

     result = handleValidation(formValuesToJsonValues(fields, formValues));
     result = handleValidation(formValuesToJsonValues(fields, formValues));
    
     We'll try to dig into this again later on and come up with a better solution.
     
     We're sorry :(
      
     P.S. Technically the JSON Schema and JSF is correct: given pet_age: 6, the dietary_needs is visible (and required).
     The challenge here is the side-effects of the validation to calculate the latest isVisible status.
     */
  });

  it('(ALTERNATIVE) Should hide dependent field if value does not satisfy conditional anymore', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        has_pet: {
          title: 'Has Pet',
          description: 'Do you have a pet?',
          oneOf: [
            {
              title: 'Yes',
              const: 'yes',
            },
            {
              title: 'No',
              const: 'no',
            },
          ],
          'x-jsf-presentation': {
            inputType: 'radio',
          },
          type: 'string',
        },
        pet_name: {
          title: "Pet's name",
          description: "What's your pet's name?",
          'x-jsf-presentation': {
            inputType: 'text',
          },
          type: 'string',
        },
        pet_age: {
          title: "Pet's age",
          description: "What's your pet's age",
          'x-jsf-presentation': {
            inputType: 'number',
          },
          type: 'number',
        },
        dietary_needs: {
          title: 'Dietary needs',
          description: "What are your pet's dietary needs?",
          'x-jsf-presentation': {
            inputType: 'textarea',
          },
          type: 'string',
        },
      },
      required: ['has_pet'],
      'x-jsf-order': ['has_pet', 'pet_name', 'pet_age', 'dietary_needs'],
      allOf: [
        {
          if: {
            properties: {
              has_pet: {
                const: 'yes',
              },
            },
            required: ['has_pet'],
          },
          then: {
            required: ['pet_age', 'pet_name'],
          },
          else: {
            properties: {
              pet_age: false,
              pet_name: false,
              dietary_needs: false,
            },
          },
        },
        {
          if: {
            properties: {
              // 📌📌📌📌 NEW: More strict JSON Schema conditional:
              has_pet: {
                const: 'yes',
              },
              pet_age: {
                minimum: 5,
              },
            },
            required: ['has_pet', 'pet_age'],
          },
          then: {
            required: ['dietary_needs'],
          },
          else: {
            properties: {
              dietary_needs: false,
            },
          },
        },
      ],
    };

    const { fields, handleValidation } = createHeadlessForm(schema, { strictInputType: false });

    let result = handleValidation({});

    // Step 1: Click on Submit without any form interaction
    expect(result.formErrors).toEqual({ has_pet: 'Required field' });
    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: false');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: false');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: false');

    // Step 2: Specify that you have a pet, form shows Pet name and age. Enter Name, skip adding age.
    result = handleValidation({ has_pet: 'yes', pet_name: 'Woofy' });

    expect(result.formErrors).toEqual({ pet_age: 'Required field' });

    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: true');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: true');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: false');

    // Step 3: Set age to be 6, to show dietary needs
    result = handleValidation({ has_pet: 'yes', pet_name: 'Woofy', pet_age: 6 });

    expect(result.formErrors).toEqual({ dietary_needs: 'Required field' });

    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: true');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: true');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: true');

    // Step 3: Change radio for Has pet to be "no". Form should be valid and
    // pet_name, pet_age and dietary_needs to be hidden

    const formValues = {
      has_pet: 'no',
      pet_name: 'Woofy',
      pet_age: 6,
    };

    // 📌📌📌📌📌📌📌
    // 📌 Now only 1 validation is needed, because the JSON Schema conditional is more strict.
    const jsonValuesFirst = formValuesToJsonValues(fields, formValues);
    expect(jsonValuesFirst).toEqual({
      has_pet: 'no',
      pet_name: 'Woofy',
      pet_age: 6,
    });
    result = handleValidation(jsonValuesFirst);

    expect(result.formErrors).toEqual(undefined);

    expect(`${fields[0].name}: ${fields[0].isVisible}`).toEqual('has_pet: true');
    expect(`${fields[1].name}: ${fields[1].isVisible}`).toEqual('pet_name: false');
    expect(`${fields[2].name}: ${fields[2].isVisible}`).toEqual('pet_age: false');
    expect(`${fields[3].name}: ${fields[3].isVisible}`).toEqual('dietary_needs: false');
  });
});
