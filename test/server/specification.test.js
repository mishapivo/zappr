import sinon from 'sinon'
import { expect } from 'chai'
import { Specification } from '../../server/checks'
import { GithubService } from '../../server/service/GithubService'

describe('Specification', () => {
  describe('#execute', () => {
    const TITLE_REQUIRED_LENGTH = 8
    const BODY_REQUIRED_LENGTH = 8

    const TOKEN = 'token'
    const STATES = ['open', 'close']
    const ACTIONS = ['opened', 'edited', 'reopened', 'synchronize']
    const SKIP_ACTIONS = ['assigned', 'unassigned', 'labeled', 'unlabeled', 'closed']

    const config = ({
      titleLength=TITLE_REQUIRED_LENGTH,
      bodyLength=BODY_REQUIRED_LENGTH
    } = {}) => ({
      specification: {
        title: {
          length: titleLength
        },
        body: {
          length: bodyLength,
          verify: {
            'contains-url': true,
            'contains-issue-number': true
          }
        }
      }
    })

    let github, pullRequest

    beforeEach(() => {
      github = sinon.createStubInstance(GithubService)
      pullRequest = new Specification(github)
    })

    SKIP_ACTIONS.forEach(action => {
      STATES.forEach(state => {
        it(`[action: '${action}'][state: '${state}'] should do nothing`, async (done) => {
          try {
            const payload = createPayload({
              action,
              pull_request: {
                state
              }
            })

            await pullRequest.execute(config(), payload, TOKEN)
            expect(github.setCommitStatus.called).to.be.false
            done()
          } catch (e) {
            done(e)
          }
        })
      })
    })

    ACTIONS.forEach(action => {
      it(`[action: '${action}'] should do nothing if state is 'close'`, async (done) => {
        try {
          const payload = createPayload(action, {
            state: 'close'
          })

          await pullRequest.execute(config(), payload, TOKEN)
          expect(github.setCommitStatus.called).to.be.false
          done()
        } catch (e) {
          done(e)
        }
      })

      it(`[action: '${action}'] should set status to 'success' if PR's title's length is more than ${TITLE_REQUIRED_LENGTH}`, async (done) => {
        try {
          const payload = createPayload(action, {
            state: 'open',
            title: 'This one is a good title for the PR',
            body: 'This one is a good body for the PR'
          })

          await pullRequest.execute(config(), payload, TOKEN)
          expect(github.setCommitStatus.calledWithExactly(
            'sample', 'one', '1a2b3c', {
              state: 'success',
              context: 'zappr/pr/specification',
              description: 'PR has passed specification checks'
            }, 'token'
          )).to.be.true
          done()
        } catch (e) {
          done(e)
        }
      })

      it(`[action: '${action}'] should set status to 'failure' if PR's title's length is less than ${TITLE_REQUIRED_LENGTH}`, async (done) => {
        try {
          const title = 'short'
          const payload = createPayload(action, {
            title,
            state: 'open',
            body: 'This one is a good body for the PR'
          })

          await pullRequest.execute(config(), payload, TOKEN)
          expect(github.setCommitStatus.calledWithExactly(
            'sample', 'one', '1a2b3c', {
              state: 'failure',
              context: 'zappr/pr/specification',
              description: `PR's title is too short (${title.length}/${TITLE_REQUIRED_LENGTH})`
            }, 'token'
          )).to.be.true
          done()
        } catch (e) {
          done(e)
        }
      })

      it(`[action: '${action}'] should set status to 'success' if PR's body's length is more than ${BODY_REQUIRED_LENGTH}`, async (done) => {
        try {
          const payload = createPayload(action, {
            state: 'open',
            title: 'This one is a good title for the PR',
            body: 'This one is a good body for the PR'
          })

          await pullRequest.execute(config(), payload, TOKEN)
          expect(github.setCommitStatus.calledWithExactly(
            'sample', 'one', '1a2b3c', {
              state: 'success',
              context: 'zappr/pr/specification',
              description: 'PR has passed specification checks'
            }, 'token'
          )).to.be.true
          done()
        } catch (e) {
          done(e)
        }
      })

      it(`[action: '${action}'] should set status to 'failure' if PR's body's length is less than ${BODY_REQUIRED_LENGTH}`, async (done) => {
        try {
          const body = 'short'
          const payload = createPayload(action, {
            body,
            state: 'open',
            title: 'This one is a good title for the PR'
          })

          await pullRequest.execute(config(), payload, TOKEN)
          expect(github.setCommitStatus.calledWithExactly(
            'sample', 'one', '1a2b3c', {
              state: 'failure',
              context: 'zappr/pr/specification',
              description: `PR's body is too short (${body.length}/${BODY_REQUIRED_LENGTH})`
            }, 'token'
          )).to.be.true
          done()
        } catch (e) {
          done(e)
        }
      });

      ['#4', 'Fix #4', 'user/repo#42', 'closes user/repo#42',
        'some-org/repo#42', 'http://tracker.com', 'https://tracker.com',
        'www.issues.example.com', 'Fix for http://some.tracker.com/issues/42'
      ].forEach(body => {
        it(`[action: '${action}'] should set status to 'success' for body '${body}'`, async (done) => {
          try {
            const payload = createPayload(action, {
              body,
              state: 'open',
              title: 'This one is a good title for the PR'
            })

            await pullRequest.execute(config({
              bodyLength: 60  // make sure that issue and url are real validators
            }), payload, TOKEN)
            expect(github.setCommitStatus.calledWithExactly(
              'sample', 'one', '1a2b3c', {
                state: 'success',
                context: 'zappr/pr/specification',
                description: 'PR has passed specification checks'
              }, 'token'
            )).to.be.true
            done()
          } catch (e) {
            done(e)
          }
        })
      })
    })
  })
})

const createPayload = (action, {title, body, state} = {}) => ({
  action,
  repository: {
    name: 'one',
    full_name: 'sample/one',
    owner: {
      login: 'sample'
    }
  },
  pull_request: {
    body,
    state,
    title,
    number: 1,
    head: {
      sha: '1a2b3c'
    }
  }
})