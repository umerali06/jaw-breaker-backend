import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TrainingModule from './nursing/models/TrainingModule.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jawbreakers', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const comprehensiveTrainingModules = [
  {
    title: "Patient Communication & Education",
    description: "Master effective communication techniques and patient education strategies for better care outcomes.",
    category: "communication",
    objectives: [
      "Use active listening techniques with patients and families",
      "Adapt communication style to different patient populations",
      "Provide clear, understandable health education",
      "Handle difficult conversations with empathy and professionalism"
    ],
    prerequisites: ["Basic nursing fundamentals"],
    estimatedDuration: 45, // minutes
    difficulty: "intermediate",
    targetRoles: ["nurse", "nurse_practitioner", "nurse_manager"],
    experienceLevel: "experienced",
    createdBy: "system",
    lastModifiedBy: "system",
    isActive: true,
    isMandatory: false,
    modules: [
      {
        title: "Active Listening Fundamentals",
        content: `# Active Listening in Nursing Practice

## Learning Objectives
By the end of this module, you will be able to:
- Identify the key components of active listening
- Apply active listening techniques in patient interactions
- Recognize barriers to effective communication
- Demonstrate empathy through verbal and non-verbal cues

## Core Concepts

### What is Active Listening?
Active listening is a communication technique that requires the listener to fully concentrate, understand, respond, and then remember what is being said. In nursing, this means:

1. **Full Attention**: Focus completely on the patient
2. **Reflective Responses**: Paraphrase what you've heard
3. **Clarifying Questions**: Ask for more information when needed
4. **Non-verbal Cues**: Use appropriate body language and eye contact

### The R.E.S.P.E.C.T. Model
- **R**ecognize the patient's emotions
- **E**ngage with genuine interest
- **S**ummarize what you've heard
- **P**araphrase for understanding
- **E**mpathize with their situation
- **C**larify any misunderstandings
- **T**ake action on their concerns

## Real-World Application
Consider this scenario: A 65-year-old patient with diabetes is struggling with medication adherence. How would you use active listening to understand their challenges?

### Key Techniques:
- **Open-ended questions**: "Tell me about your experience with your diabetes medication."
- **Reflective statements**: "It sounds like you're feeling overwhelmed by the number of medications."
- **Empathetic responses**: "I can understand how challenging it must be to manage multiple medications daily."

## Common Barriers to Avoid
- Interrupting the patient
- Making assumptions
- Being distracted by other tasks
- Rushing through the conversation
- Using medical jargon without explanation`,
        order: 1,
        estimatedTime: 15
      },
      {
        title: "Cultural Sensitivity in Communication",
        content: `# Cultural Sensitivity in Nursing Communication

## Learning Objectives
- Recognize cultural differences that may affect communication
- Adapt communication strategies for diverse populations
- Respect cultural beliefs and practices
- Build trust across cultural boundaries

## Understanding Cultural Competence

### Key Principles
1. **Cultural Awareness**: Recognize your own cultural biases
2. **Cultural Knowledge**: Learn about different cultural practices
3. **Cultural Skills**: Develop appropriate communication techniques
4. **Cultural Encounters**: Practice with diverse populations

### Communication Considerations

#### Language Barriers
- Use professional interpreters when needed
- Avoid family members as interpreters for medical information
- Speak slowly and clearly
- Use visual aids and written materials

#### Non-verbal Communication
- Eye contact: Varies by culture (some cultures avoid direct eye contact)
- Personal space: Respect different comfort levels
- Touch: Some cultures have specific rules about physical contact
- Gestures: Be aware that meanings may differ

## Case Study: Mrs. Chen
Mrs. Chen, a 72-year-old Chinese patient, seems reluctant to discuss her pain management. Her family speaks for her during visits. How do you ensure she receives appropriate care while respecting cultural norms?

### Approach:
1. Address the patient directly, even if family is present
2. Ask about cultural preferences regarding pain management
3. Use culturally appropriate pain assessment tools
4. Involve the family while maintaining patient autonomy

## Practical Tips
- Learn basic greetings in common languages in your area
- Ask about cultural preferences regarding healthcare
- Be patient and allow extra time for communication
- Show respect for cultural practices and beliefs`,
        order: 2,
        estimatedTime: 15
      },
      {
        title: "Patient Education Strategies",
        content: `# Effective Patient Education

## Learning Objectives
- Develop patient education plans based on individual needs
- Use appropriate teaching methods for different learning styles
- Evaluate patient understanding and retention
- Create educational materials that are accessible and clear

## The Teach-Back Method

### What is Teach-Back?
Teach-back is a technique to verify patient understanding by asking them to explain in their own words what they need to know or do.

### Steps:
1. **Explain**: Provide information in simple terms
2. **Ask**: "Can you tell me in your own words what we discussed?"
3. **Listen**: Pay attention to their explanation
4. **Clarify**: Correct any misunderstandings
5. **Repeat**: Continue until understanding is confirmed

### Example:
**Nurse**: "I've explained how to check your blood sugar. Can you show me how you would do it?"
**Patient**: "I would wash my hands, put the test strip in the meter, prick my finger, and put the blood on the strip."
**Nurse**: "That's exactly right! You've got it."

## Learning Styles and Adaptations

### Visual Learners
- Use diagrams, charts, and pictures
- Provide written materials
- Show videos or demonstrations
- Use color coding for different concepts

### Auditory Learners
- Explain verbally with clear descriptions
- Use analogies and stories
- Encourage questions and discussion
- Provide audio recordings if helpful

### Kinesthetic Learners
- Provide hands-on practice
- Use role-playing scenarios
- Create interactive activities
- Allow them to demonstrate procedures

## Health Literacy Considerations

### Signs of Low Health Literacy
- Difficulty filling out forms
- Asking few questions
- Missing appointments
- Not following medication instructions
- Avoiding complex health topics

### Strategies for Low Health Literacy
- Use simple, everyday language
- Break information into small chunks
- Use the "chunk and check" method
- Provide written materials at appropriate reading level
- Use teach-back to verify understanding

## Creating Effective Educational Materials

### Design Principles
- Use large, clear fonts (12-point minimum)
- Include plenty of white space
- Use bullet points and numbered lists
- Include relevant pictures or diagrams
- Use simple, familiar words

### Content Guidelines
- Focus on what the patient needs to know
- Prioritize the most important information
- Use active voice
- Avoid medical jargon
- Include action steps`,
        order: 3,
        estimatedTime: 15
      }
    ],
    quizzes: [
      {
        question: "What is the most important component of active listening?",
        options: [
          "Asking many questions",
          "Giving advice immediately",
          "Fully concentrating on the patient",
          "Taking detailed notes"
        ],
        correctAnswer: 2,
        explanation: "Active listening requires full concentration on the patient to understand their concerns and needs."
      },
      {
        question: "When using the teach-back method, what should you do if the patient's explanation is incorrect?",
        options: [
          "Move on to the next topic",
          "Correct the misunderstanding and repeat the process",
          "Ask a family member to explain",
          "Provide written materials instead"
        ],
        correctAnswer: 1,
        explanation: "If the patient's explanation is incorrect, you should clarify the misunderstanding and continue with teach-back until understanding is confirmed."
      },
      {
        question: "Which of the following is NOT a sign of low health literacy?",
        options: [
          "Difficulty filling out forms",
          "Asking many detailed questions",
          "Missing appointments",
          "Not following medication instructions"
        ],
        correctAnswer: 1,
        explanation: "Asking many detailed questions actually indicates good health literacy and engagement, not low health literacy."
      }
    ],
    practicalApplications: [
      {
        title: "Communication Scenario Practice",
        description: "Practice active listening with a patient who is anxious about their upcoming surgery.",
        scenario: "You are caring for Mr. Johnson, a 58-year-old patient scheduled for cardiac bypass surgery tomorrow. He appears anxious and keeps asking the same questions about the procedure. His family is also very concerned and keeps interrupting with their own questions.",
        tasks: [
          "Demonstrate active listening techniques",
          "Address the family's concerns while maintaining focus on the patient",
          "Use teach-back to ensure understanding of pre-operative instructions",
          "Show empathy while providing reassurance"
        ],
        evaluationCriteria: [
          "Uses open-ended questions effectively",
          "Demonstrates reflective listening",
          "Maintains professional boundaries with family",
          "Provides clear, understandable information"
        ]
      },
      {
        title: "Cultural Sensitivity Exercise",
        description: "Adapt your communication approach for a patient from a different cultural background.",
        scenario: "Mrs. Rodriguez, a 45-year-old Hispanic patient, has been diagnosed with diabetes. She speaks limited English and her adult daughter often translates. She seems hesitant to discuss her symptoms and appears to be relying heavily on traditional remedies.",
        tasks: [
          "Respect cultural beliefs while providing medical information",
          "Ensure the patient receives information directly, not just through family",
          "Address concerns about traditional vs. medical treatments",
          "Create a culturally appropriate care plan"
        ],
        evaluationCriteria: [
          "Shows respect for cultural practices",
          "Uses appropriate communication methods",
          "Balances medical advice with cultural sensitivity",
          "Involves patient in decision-making"
        ]
      }
    ],
    aiAnalysis: {
      learningObjectives: [
        "Master active listening techniques for patient care",
        "Develop cultural competence in healthcare communication",
        "Create effective patient education strategies",
        "Apply communication skills in challenging situations"
      ],
      keyCompetencies: [
        "Therapeutic communication",
        "Cultural sensitivity",
        "Patient education",
        "Conflict resolution",
        "Empathy and compassion"
      ],
      assessmentMethods: [
        "Role-playing scenarios",
        "Written reflections",
        "Peer evaluations",
        "Patient feedback",
        "Practical demonstrations"
      ]
    }
  },
  {
    title: "Medication Administration & Safety",
    description: "Comprehensive training on safe medication administration, error prevention, and patient safety protocols.",
    category: "medication_management",
    objectives: [
      "Administer medications safely using the 5 rights",
      "Identify and prevent medication errors",
      "Calculate dosages accurately",
      "Document medication administration properly"
    ],
    prerequisites: ["Basic pharmacology knowledge"],
    estimatedDuration: 60,
    difficulty: "intermediate",
    targetRoles: ["nurse", "nurse_practitioner"],
    experienceLevel: "experienced",
    createdBy: "system",
    lastModifiedBy: "system",
    isActive: true,
    isMandatory: true,
    modules: [
      {
        title: "The 5 Rights of Medication Administration",
        content: `# The 5 Rights of Medication Administration

## Learning Objectives
- Identify the 5 rights of medication administration
- Apply each right in clinical practice
- Recognize potential violations of the 5 rights
- Implement safety checks to prevent errors

## The 5 Rights Framework

### 1. Right Patient
**What it means**: Verify the patient's identity before administering any medication.

**How to verify**:
- Check the patient's identification band
- Ask the patient to state their name and date of birth
- Compare with the medication administration record (MAR)
- Use two patient identifiers (name + DOB or medical record number)

**Common errors**:
- Administering medication to the wrong patient
- Confusing patients with similar names
- Not verifying identity when patient is sleeping or confused

### 2. Right Medication
**What it means**: Ensure you have the correct medication as ordered.

**Safety checks**:
- Read the medication label three times
- Compare with the physician's order
- Check the medication name, strength, and form
- Verify the medication hasn't expired
- Be aware of look-alike, sound-alike medications

**High-risk medications**:
- Insulin
- Anticoagulants (warfarin, heparin)
- Narcotics
- Chemotherapy drugs
- Potassium chloride

### 3. Right Dose
**What it means**: Administer the correct amount of medication.

**Calculation methods**:
- Use the formula: (Desired dose ÷ Available dose) × Volume = Amount to give
- Double-check calculations with another nurse
- Use appropriate measuring devices
- Consider patient's weight and age for pediatric/geriatric patients

**Common calculation errors**:
- Decimal point errors (0.5 mg vs 5 mg)
- Unit conversion errors (mg vs mcg)
- Incorrect formula application
- Rounding errors

### 4. Right Route
**What it means**: Administer the medication by the correct route.

**Common routes**:
- Oral (PO)
- Intravenous (IV)
- Intramuscular (IM)
- Subcutaneous (SQ)
- Topical
- Rectal
- Inhalation

**Route-specific considerations**:
- IV medications must be compatible with IV fluids
- Some medications are only available in specific forms
- Patient condition may affect route selection
- Some routes require special training

### 5. Right Time
**What it means**: Administer the medication at the correct time.

**Timing considerations**:
- Check the prescribed frequency
- Consider drug interactions with meals
- Account for patient's schedule and preferences
- Follow facility policies for time windows

**Time window guidelines**:
- Most medications: ±30 minutes
- Critical medications: ±15 minutes
- PRN medications: As needed
- STAT medications: Immediately

## Safety Protocols

### Pre-Administration Checks
1. Verify the 5 rights
2. Check for allergies
3. Assess patient condition
4. Review drug interactions
5. Prepare necessary equipment

### During Administration
1. Maintain sterile technique for injections
2. Monitor patient response
3. Document immediately
4. Observe for adverse reactions

### Post-Administration
1. Monitor for effectiveness
2. Watch for side effects
3. Document patient response
4. Report any concerns

## Error Prevention Strategies

### Technology Solutions
- Barcode scanning systems
- Automated dispensing cabinets
- Computerized physician order entry (CPOE)
- Clinical decision support systems

### Human Factors
- Adequate staffing levels
- Clear communication
- Proper training and competency
- Non-punitive error reporting

### Environmental Factors
- Well-lit medication preparation areas
- Minimal distractions
- Organized medication storage
- Clear labeling systems`,
        order: 1,
        estimatedTime: 20
      },
      {
        title: "Medication Error Prevention",
        content: `# Medication Error Prevention

## Learning Objectives
- Identify common types of medication errors
- Implement strategies to prevent errors
- Recognize high-risk situations
- Respond appropriately when errors occur

## Types of Medication Errors

### Prescribing Errors
- Wrong medication
- Wrong dose
- Wrong route
- Wrong frequency
- Drug interactions
- Allergic reactions

### Dispensing Errors
- Wrong medication selected
- Incorrect dosage calculation
- Wrong patient label
- Expired medication
- Contaminated medication

### Administration Errors
- Wrong patient
- Wrong medication
- Wrong dose
- Wrong route
- Wrong time
- Omitted dose

### Monitoring Errors
- Failure to monitor for side effects
- Inadequate follow-up
- Missing laboratory values
- Delayed response to adverse reactions

## High-Risk Situations

### Patient Factors
- Multiple medications
- Complex medical conditions
- Cognitive impairment
- Language barriers
- Non-compliance

### Medication Factors
- High-alert medications
- Look-alike, sound-alike drugs
- New medications
- Complex dosing regimens
- Narrow therapeutic index

### System Factors
- Staffing shortages
- High patient acuity
- Interruptions during administration
- Inadequate training
- Poor communication

## Prevention Strategies

### Individual Level
- Follow the 5 rights consistently
- Double-check calculations
- Ask questions when uncertain
- Report near-misses
- Stay current with education

### Team Level
- Clear communication
- Standardized processes
- Peer review
- Team huddles
- Shared responsibility

### System Level
- Technology solutions
- Policy development
- Training programs
- Quality improvement
- Culture of safety

## Look-Alike, Sound-Alike (LASA) Medications

### Common LASA Pairs
- Celebrex vs. Celexa
- Zantac vs. Zyrtec
- Lasix vs. Losec
- Humalog vs. Humulin
- Coumadin vs. Cardura

### Prevention Strategies
- Tall man lettering (e.g., DOPamine vs. DOBUTamine)
- Separate storage
- Clear labeling
- Computer alerts
- Staff education

## Error Reporting and Response

### When an Error Occurs
1. **Immediate response**:
   - Ensure patient safety
   - Notify physician
   - Monitor patient closely
   - Document the incident

2. **Follow-up actions**:
   - Complete incident report
   - Participate in root cause analysis
   - Implement corrective actions
   - Learn from the experience

### Near-Miss Reporting
- Report all near-misses
- Focus on system improvements
- Non-punitive approach
- Learning opportunities
- Process improvements

## Quality Improvement

### Metrics to Track
- Error rates by type
- Near-miss frequency
- Root cause analysis results
- Staff competency levels
- Patient outcomes

### Improvement Strategies
- Regular training updates
- Process standardization
- Technology enhancements
- Staff feedback incorporation
- Best practice sharing`,
        order: 2,
        estimatedTime: 20
      },
      {
        title: "Dosage Calculations",
        content: `# Medication Dosage Calculations

## Learning Objectives
- Master basic dosage calculation formulas
- Apply calculations to real-world scenarios
- Identify and correct calculation errors
- Use appropriate measuring devices

## Basic Calculation Formulas

### Formula Method
**Formula**: (Desired dose ÷ Available dose) × Volume = Amount to give

**Example**: Order: Morphine 5 mg IV
Available: Morphine 10 mg/1 mL
Calculation: (5 mg ÷ 10 mg) × 1 mL = 0.5 mL

### Dimensional Analysis
**Steps**:
1. Start with the desired dose
2. Multiply by conversion factors
3. Cancel out units
4. Solve for the answer

**Example**: Order: 0.25 mg of digoxin
Available: 0.5 mg/2 mL
Calculation: 0.25 mg × (2 mL ÷ 0.5 mg) = 1 mL

### Ratio and Proportion
**Set up**: Available dose : Available volume = Desired dose : X

**Example**: Order: 750 mg of amoxicillin
Available: 500 mg/5 mL
Set up: 500 mg : 5 mL = 750 mg : X
Cross multiply: 500X = 3750
Solve: X = 7.5 mL

## Common Calculation Scenarios

### Oral Medications
**Tablets**: Usually given as whole tablets
**Liquid medications**: Calculate volume needed

**Example**: Order: Acetaminophen 650 mg PO
Available: 325 mg tablets
Calculation: 650 mg ÷ 325 mg = 2 tablets

### Injectable Medications
**IV push**: Calculate volume for direct injection
**IV piggyback**: Calculate volume for infusion bag

**Example**: Order: Furosemide 40 mg IV push
Available: 20 mg/2 mL
Calculation: (40 mg ÷ 20 mg) × 2 mL = 4 mL

### IV Infusions
**Formula**: (Desired rate × Volume) ÷ Concentration = Drip rate

**Example**: Order: Dopamine 5 mcg/kg/min
Patient weight: 70 kg
Available: 400 mg/250 mL
Calculation:
- Desired dose: 5 mcg/kg/min × 70 kg = 350 mcg/min
- Concentration: 400 mg = 400,000 mcg
- Concentration per mL: 400,000 mcg ÷ 250 mL = 1,600 mcg/mL
- Rate: (350 mcg/min × 1 mL) ÷ 1,600 mcg/mL = 0.22 mL/min

## Pediatric Calculations

### Weight-Based Dosing
**Formula**: Dose per kg × Patient weight = Total dose

**Example**: Order: Amoxicillin 25 mg/kg/day
Patient weight: 15 kg
Calculation: 25 mg/kg × 15 kg = 375 mg/day

### Body Surface Area (BSA)
**Formula**: √[(Height in cm × Weight in kg) ÷ 3600]

**Example**: Patient height: 100 cm, weight: 20 kg
BSA: √[(100 × 20) ÷ 3600] = √[2000 ÷ 3600] = √0.56 = 0.75 m²

## Geriatric Considerations

### Age-Related Changes
- Decreased kidney function
- Altered drug metabolism
- Multiple medications
- Increased sensitivity

### Dosing Adjustments
- Start with lower doses
- Monitor closely for side effects
- Consider drug interactions
- Adjust for kidney function

## Safety Checks

### Double-Checking Calculations
1. Calculate independently
2. Have another nurse verify
3. Use different methods
4. Check against normal ranges
5. Consider patient factors

### Red Flags
- Doses outside normal ranges
- Unusual decimal places
- Very small or large volumes
- Patient complaints
- Unexpected responses

## Common Errors to Avoid

### Decimal Point Errors
- 0.5 mg vs 5 mg (10-fold difference)
- Always use leading zeros: 0.5 mg
- Never use trailing zeros: 5.0 mg

### Unit Conversion Errors
- mg vs mcg (1,000-fold difference)
- g vs mg (1,000-fold difference)
- L vs mL (1,000-fold difference)

### Formula Errors
- Wrong formula selection
- Incorrect setup
- Calculation mistakes
- Rounding errors

## Practice Problems

### Problem 1
Order: Digoxin 0.125 mg PO daily
Available: 0.25 mg tablets
How many tablets should you give?

### Problem 2
Order: Morphine 2 mg IV push
Available: 10 mg/1 mL
How many mL should you give?

### Problem 3
Order: Heparin 5,000 units IV
Available: 10,000 units/1 mL
How many mL should you give?

### Answers
1. 0.5 tablets (half tablet)
2. 0.2 mL
3. 0.5 mL`,
        order: 3,
        estimatedTime: 20
      }
    ],
    quizzes: [
      {
        question: "What is the first step in the 5 rights of medication administration?",
        options: [
          "Right medication",
          "Right patient",
          "Right dose",
          "Right time"
        ],
        correctAnswer: 1,
        explanation: "Right patient is the first step - you must verify the patient's identity before administering any medication."
      },
      {
        question: "If you have an order for 10 mg of morphine and the available concentration is 5 mg/1 mL, how many mL should you administer?",
        options: [
          "0.5 mL",
          "1 mL",
          "2 mL",
          "5 mL"
        ],
        correctAnswer: 2,
        explanation: "Using the formula (Desired ÷ Available) × Volume: (10 mg ÷ 5 mg) × 1 mL = 2 mL"
      },
      {
        question: "Which of the following is considered a high-alert medication?",
        options: [
          "Acetaminophen",
          "Insulin",
          "Multivitamin",
          "Antacid"
        ],
        correctAnswer: 1,
        explanation: "Insulin is a high-alert medication because it has a narrow therapeutic index and can cause serious harm if administered incorrectly."
      }
    ],
    practicalApplications: [
      {
        title: "Medication Administration Simulation",
        description: "Practice safe medication administration using the 5 rights in a simulated patient scenario.",
        scenario: "You are preparing to administer medications to Mrs. Smith, a 78-year-old patient with multiple chronic conditions. Her medication list includes: Metformin 500 mg PO twice daily, Lisinopril 10 mg PO daily, and Warfarin 5 mg PO daily. She has a known allergy to penicillin.",
        tasks: [
          "Verify the 5 rights for each medication",
          "Check for drug interactions",
          "Calculate correct dosages",
          "Prepare medications safely",
          "Document administration properly"
        ],
        evaluationCriteria: [
          "Correctly identifies patient using two identifiers",
          "Verifies each medication against the order",
          "Calculates dosages accurately",
          "Checks for allergies and interactions",
          "Documents administration immediately"
        ]
      },
      {
        title: "Error Prevention Exercise",
        description: "Identify potential medication errors and implement prevention strategies.",
        scenario: "During medication pass, you notice several potential issues: a medication cup labeled for another patient, a vial that appears to be the wrong concentration, and a patient who seems confused about their medications.",
        tasks: [
          "Identify potential errors",
          "Implement safety checks",
          "Communicate concerns appropriately",
          "Take corrective action",
          "Document the incident"
        ],
        evaluationCriteria: [
          "Recognizes potential errors quickly",
          "Follows safety protocols",
          "Communicates effectively with team",
          "Takes appropriate corrective action",
          "Documents incident properly"
        ]
      }
    ],
    aiAnalysis: {
      learningObjectives: [
        "Master the 5 rights of medication administration",
        "Prevent medication errors through systematic approaches",
        "Calculate dosages accurately and safely",
        "Apply safety protocols in clinical practice"
      ],
      keyCompetencies: [
        "Medication safety",
        "Dosage calculations",
        "Error prevention",
        "Patient safety",
        "Clinical reasoning"
      ],
      assessmentMethods: [
        "Calculation competency tests",
        "Simulation scenarios",
        "Peer evaluations",
        "Clinical observations",
        "Error analysis exercises"
      ]
    }
  }
];

async function createComprehensiveTraining() {
  try {
    console.log('Creating comprehensive nursing training modules...');
    
    // Clear existing training modules
    await TrainingModule.deleteMany({});
    console.log('Cleared existing training modules');
    
    // Create new comprehensive modules
    for (const moduleData of comprehensiveTrainingModules) {
      const trainingModule = new TrainingModule(moduleData);
      await trainingModule.save();
      console.log(`Created training module: ${moduleData.title}`);
    }
    
    console.log('✅ Comprehensive training modules created successfully!');
    console.log(`Created ${comprehensiveTrainingModules.length} training modules`);
    
    // Display summary
    const modules = await TrainingModule.find({});
    console.log('\n📚 Training Modules Summary:');
    modules.forEach(module => {
      console.log(`- ${module.title} (${module.modules.length} modules, ${module.estimatedDuration} min)`);
    });
    
  } catch (error) {
    console.error('Error creating training modules:', error);
  } finally {
    mongoose.connection.close();
  }
}

createComprehensiveTraining();
