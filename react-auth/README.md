## `@reshuffle/react-auth`
React context for adding "out-of-the-box" auth to your app using `@reshuffle/passport`.

See a fully working demo [here](https://github.com/reshufflehq/auth-template).

### Installation
```console
$ npm install @reshuffle/react-auth
```

### Prerequisites
* Install `@reshuffle/passport`
* Configure `backend/_handler.js` to use `@reshuffle/passport`, see [instructions](../passport/README.md#usage)

### Usage
Wrap your root component with `AuthProvider`.

`src/App.js`
```jsx
import React from 'react';
import { AuthProvider } from '@reshuffle/react-auth';
import Main from './components/Main';

export default function App() {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
}
```

Use with react hooks.

`src/components/Main`
```jsx
import React from 'react';
import { useAuth } from '@reshuffle/react-auth';

export default function Main() {
  const {
    loading,
    error,
    authenticated,
    profile,
    getLoginURL,
    getLogoutURL,
    login,
  } = useAuth();

  if (loading) {
    return <div><h2>Loading...</h2></div>;
  }
  if (error) {
    return <div className='error'><h1>{error.toString()}</h1></div>;
  }
  if (!authenticated) {
    return (
      <>
        <a href={getLoginURL()}>Login in same window</a>
        <a href='/login' onClick={(e) => { login({ newWindow: true }); e.preventDefault(); }}>Login from new window</a>
      </>
    );
  }
  return (
    <>
      <img src={profile.picture} />
      <span>{profile.displayName}</span>
      <a href={getLogoutURL()}>Logout</a>
    </>
  );
}
```

Use with react class components.

`src/components/Main`
```jsx
import React from 'react';
import { AuthContext } from '@reshuffle/react-auth';

export default class Main extends React.Component {
  static contextType = AuthContext;

  render() {
    const {
      loading,
      error,
      authenticated,
      profile,
      getLoginURL,
      getLogoutURL,
      login,
    } = this.context;

    if (loading) {
      return <div><h2>Loading...</h2></div>;
    }
    if (error) {
      return <div className='error'><h1>{error.toString()}</h1></div>;
    }
    if (!authenticated) {
      <>
        <a href={getLoginURL()}>Login in same window</a>
        <a href='/login' onClick={(e) => { login({ newWindow: true }); e.preventDefault(); }}>Login from new window</a>
      </>
    }
    return (
      <>
        <img src={profile.picture} />
        <span>{profile.displayName}</span>
        <a href={getLogoutURL()}>Logout</a>
      </>
    );
  }
}
```
