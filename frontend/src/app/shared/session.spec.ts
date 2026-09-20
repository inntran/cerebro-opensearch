import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Session } from './session';

describe('Session', () => {
  let session: Session;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    session = TestBed.inject(Session);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the selected host and credentials to the backend', async () => {
    session.connect('http://localhost:9200', 'alice', 'secret');
    const result = session.send<{ status: string }>('overview');
    const request = http.expectOne('/overview');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      host: 'http://localhost:9200',
      username: 'alice',
      password: 'secret',
    });
    request.flush({ status: 200, body: { status: 'green' } });
    await expect(result).resolves.toEqual({ status: 'green' });
  });

  it('rejects failed cluster responses', async () => {
    session.connect('http://localhost:9200');
    const result = session.send('overview');
    http.expectOne('/overview').flush({ status: 500, body: { error: 'unavailable' } });
    await expect(result).rejects.toEqual({ error: 'unavailable' });
  });

  it('uses the connection probe without setting a host', async () => {
    const result = session.probe('http://localhost:9200');
    const request = http.expectOne('/connect');
    expect(request.request.body.host).toBe('http://localhost:9200');
    request.flush({ status: 200, body: {} });
    await expect(result).resolves.toBe(200);
    expect(session.host()).toBeNull();
  });
});
