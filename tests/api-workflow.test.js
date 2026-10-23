const request = require('supertest');
const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
const mongoUri = process.env.MONGO_URI;

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const customerEmail = `customer-${runId}@example.com`;
const anotherCustomerEmail = `another-${runId}@example.com`;
const password = 'TestPassword123!';

describe('Salon API', () => {
  let users;
  let salons;
  let services;
  let bookings;

  let salon;
  let service;
  let stylist;
  let date;
  let availableSlot;

  let customerToken;
  let customerId;
  let anotherCustomerToken;
  let bookingId;

  beforeAll(async () => {
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing from .env');
    }

    const match = mongoUri.match(
      /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?/]*)/i
    );

    if (!match || match[1] !== 'salon-test-db') {
      throw new Error('Tests must use the salon-test-db database');
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });

    const database = mongoose.connection.db;

    if (!database) {
      throw new Error('Could not access the test database');
    }

    users = database.collection('users');
    salons = database.collection('salons');
    services = database.collection('services');
    bookings = database.collection('bookings');

    salon = await salons.findOne({
      name: 'Elegant Beauty Salon'
    });

    if (!salon) {
      throw new Error('Salon seed data is missing');
    }

    service = await services.findOne({
      name: 'Men Haircut',
      salonId: salon._id
    });

    if (!service) {
      throw new Error('Service seed data is missing');
    }

    stylist = await users.findOne({
      role: 'stylist'
    });

    if (!stylist) {
      throw new Error('Stylist seed data is missing');
    }

    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 7);
    date = futureDate.toISOString().slice(0, 10);
  }, 30000);

  afterAll(async () => {
    try {
      if (users && bookings) {
        const testUsers = await users.find({
          email: {
            $in: [customerEmail, anotherCustomerEmail]
          }
        }).toArray();

        const testUserIds = testUsers.map(user => user._id);

        if (testUserIds.length > 0) {
          await bookings.deleteMany({
            customerId: {
              $in: testUserIds
            }
          });
        }

        await users.deleteMany({
          email: {
            $in: [customerEmail, anotherCustomerEmail]
          }
        });
      }
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  });

  function getBookingDetails() {
    return {
      salonId: String(salon._id),
      stylistId: String(availableSlot.stylistId),
      serviceId: String(service._id),
      slotTime: availableSlot.time,
      date
    };
  }

  test('rejects an availability request without required parameters', async () => {
    const response = await request(baseUrl)
      .get(`/api/salons/${salon._id}/available-slots`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'date and serviceId are required'
    );
  });

  test('registers a new customer', async () => {
    const response = await request(baseUrl)
      .post('/api/register')
      .send({
        name: 'API Test Customer',
        email: customerEmail,
        password
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      'User registered successfully'
    );
  });

  test('rejects registration with an existing email', async () => {
    const response = await request(baseUrl)
      .post('/api/register')
      .send({
        name: 'Duplicate Customer',
        email: customerEmail,
        password
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Email already in use');
  });

  test('logs in the registered customer', async () => {
    const response = await request(baseUrl)
      .post('/api/login')
      .send({
        email: customerEmail,
        password
      });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('customer');
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.userId).toEqual(expect.any(String));

    customerToken = response.body.token;
    customerId = response.body.userId;
  });

  test('rejects login with an incorrect password', async () => {
    const response = await request(baseUrl)
      .post('/api/login')
      .send({
        email: customerEmail,
        password: 'WrongPassword123!'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid credentials');
  });

  test('returns available slots for a valid salon and service', async () => {
    const response = await request(baseUrl)
      .get(`/api/salons/${salon._id}/available-slots`)
      .query({
        date,
        serviceId: String(service._id)
      });

    expect(response.status).toBe(200);
    expect(response.body.date).toBe(date);
    expect(response.body.service).toBe('Men Haircut');
    expect(response.body.duration).toBe(30);
    expect(Array.isArray(response.body.availableSlots)).toBe(true);

    availableSlot = response.body.availableSlots.find(
      slot => String(slot.stylistId) === String(stylist._id)
    );

    expect(availableSlot).toBeDefined();
  });

  test('rejects booking without an authentication token', async () => {
    const response = await request(baseUrl)
      .post('/api/bookings')
      .send(getBookingDetails());

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  test('rejects booking with an invalid token', async () => {
    const response = await request(baseUrl)
      .post('/api/bookings')
      .set('Authorization', 'Bearer invalid-token')
      .send(getBookingDetails());

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid token');
  });

  test('rejects a booking without a date', async () => {
    const {
      date: ignoredDate,
      ...bookingDetails
    } = getBookingDetails();

    const response = await request(baseUrl)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(bookingDetails);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('date is required');
  });

  test('rejects booking with a service that does not exist', async () => {
    const response = await request(baseUrl)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        ...getBookingDetails(),
        serviceId: '000000000000000000000000'
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Service not found');
  });

  test('creates a booking successfully', async () => {
    const response = await request(baseUrl)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(getBookingDetails());

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      'Booking created successfully'
    );

    expect(response.body.booking).toEqual(
      expect.objectContaining({
        salonId: String(salon._id),
        stylistId: String(availableSlot.stylistId),
        customerId,
        serviceId: String(service._id),
        date,
        startTime: availableSlot.time,
        status: 'booked'
      })
    );

    bookingId = response.body.booking._id;
    expect(bookingId).toEqual(expect.any(String));
  });

  test('rejects another booking in the same time slot', async () => {
    const response = await request(baseUrl)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(getBookingDetails());

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'Time slot is no longer available'
    );
  });

  test('registers and logs in another customer', async () => {
    const registration = await request(baseUrl)
      .post('/api/register')
      .send({
        name: 'Another API Customer',
        email: anotherCustomerEmail,
        password
      });

    expect(registration.status).toBe(201);

    const login = await request(baseUrl)
      .post('/api/login')
      .send({
        email: anotherCustomerEmail,
        password
      });

    expect(login.status).toBe(200);
    expect(login.body.role).toBe('customer');
    expect(login.body.token).toEqual(expect.any(String));

    anotherCustomerToken = login.body.token;
  });

  test('prevents another customer from cancelling the booking', async () => {
    const response = await request(baseUrl)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${anotherCustomerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(
      'Not authorized to cancel this booking'
    );
  });

  test('returns not found for a booking that does not exist', async () => {
    const response = await request(baseUrl)
      .post('/api/bookings/000000000000000000000000/cancel')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Booking not found');
  });

  test('allows the owner to cancel their booking', async () => {
    const response = await request(baseUrl)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      'Booking cancelled successfully'
    );
  });

  test('rejects cancellation when the booking is already cancelled', async () => {
    const response = await request(baseUrl)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'Booking is already cancelled'
    );
  });
});