const axios = require('axios');
const { z } = require('zod');
const AppError = require('../utils/AppError');

// Zod Schema to enforce strict output
const ItinerarySchema = z.object({
  trip_title: z.string(),
  days: z.array(
    z.object({
      day_number: z.number(),
      activities: z.array(
        z.object({
          title: z.string(),
          type: z.enum(['hotel', 'food', 'activity', 'transit']),
          start_time: z.string(),
          location_name: z.string(),
        })
      ),
    })
  ),
});

class AIIntegrator {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.maxRetries = 2;
  }

  async generateItinerary(promptData, attempt = 1, previousErrors = null) {
    if (!this.apiKey) {
      console.warn("OPENAI_API_KEY missing. Returning mock data.");
      return this._getMockData(promptData);
    }

    let systemPrompt = `You are an expert travel concierge. Create a geographically optimized day-by-day itinerary.
    Output strictly as a JSON object matching this schema: ${JSON.stringify(ItinerarySchema.shape)}.`;

    if (previousErrors) {
      systemPrompt += `\nYour last attempt failed validation. Fix these errors: ${previousErrors}`;
    }

    const userPrompt = `Destination: ${promptData.destination}, Duration: ${promptData.days} days, Budget: ${promptData.budget}, Preferences: ${promptData.preferences}`;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'gpt-4o', // Or gpt-3.5-turbo for cost saving
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000, // 20 seconds
        }
      );

      const rawJsonString = response.data.choices[0].message.content;
      const parsedData = JSON.parse(rawJsonString);

      // Gatekeeper: Validate with Zod
      const validatedData = ItinerarySchema.parse(parsedData);
      return validatedData;

    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn(`[AI Integrator] Zod Validation Failed. Attempt ${attempt}/${this.maxRetries}`);
        if (attempt < this.maxRetries) {
          // Self-Healing Loop
          return this.generateItinerary(promptData, attempt + 1, error.message);
        }
        throw new AppError('AI generated invalid itinerary format after retries.', 500);
      }

      console.error(`[AI Integrator] Network/API Error:`, error.message);
      throw new AppError('Failed to generate itinerary due to upstream API error.', 502);
    }
  }

  // Fallback / Development Mock
  _getMockData(promptData) {
    return {
      trip_title: `Magical ${promptData.destination} Getaway`,
      days: [
        {
          day_number: 1,
          activities: [
            {
              title: "Arrive & Check-in",
              type: "hotel",
              start_time: "14:00",
              location_name: `Central Hotel ${promptData.destination}`,
            },
            {
              title: "Welcome Dinner",
              type: "food",
              start_time: "19:00",
              location_name: "Local Restaurant",
            }
          ],
        },
      ],
    };
  }
}

module.exports = new AIIntegrator();
