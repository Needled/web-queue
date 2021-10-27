import React, {useEffect, useState} from 'react';
import './App.css';
import {
    collection,
    addDoc,
    doc,
    getDoc,
    setDoc,
    getDocs,
    onSnapshot,
    query,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    limit,
    serverTimestamp,
    DocumentData,
    QuerySnapshot,
    runTransaction
} from 'firebase/firestore';
import {getFirestore} from "firebase/firestore";
import {initializeApp} from 'firebase/app';

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore();

export interface QueueMetadata {
    currentPosition: number;
    lastInQueue: number;
}

export interface Customer {
    userName: string;
    position: number;
}

function App() {
    const [userName, setUserName] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [queueName, setQueueName] = useState("myQueue"); // collection should be initialized based on queue we are working on -> each customer(corporate) gets his own queue collection
    const [queueSnapshot, setQueueSnapshot] = useState<Customer[]>([]);
    const queueCollection = collection(db, queueName);
    const metadata = doc(db, 'metadata/' + queueName);

    const queryForQueueDocs = query(
        queueCollection,
        // limit(20) // good to keep a limit in the size, but not relevant for this demo
    );

    function updateQueueInformation(queueData: QuerySnapshot<DocumentData>, currentPosition: number) {
        let customerQueue: Customer[] = [];
        queueData.forEach(customer => {
            customerQueue = ([...customerQueue, {
                userName: customer.data().userName,
                position: customer.data().position
            }]);
        });
        customerQueue = customerQueue.filter(customer => customer.position > currentPosition); // remove customers that have been served/skipped from the queue
        customerQueue.sort((a, b) => a.position - b.position); // sort queue in actual position order
        setQueueSnapshot(customerQueue);
        console.log('Setting up queue information');
        console.log(customerQueue);
    }

    useEffect(() => {
        return onSnapshot(metadata, (metaSnapshot) => {
            if (metaSnapshot.exists()) {
                getDocs(queryForQueueDocs).then(queueData => {
                        updateQueueInformation(queueData, metaSnapshot.data().currentPosition)
                    },
                    err => console.error('Error fetching queue information: ', err));
                console.log('Setting queue metadata information');
                console.log(metaSnapshot.data());
            } else {
                // init metadata if doc is missing
                setDoc(metadata, {currentPosition: 0, lastInQueue: 0}).catch(err => console.error('Unable to initialize metadata queue: ', err));
            }
        });
    }, []);

    useEffect(() => {
        return onSnapshot(queryForQueueDocs, (queueData) => {
            getDoc(metadata).then(meta => {
                    if (meta.exists()) {
                        updateQueueInformation(queueData, meta.data().currentPosition);
                    }
                },
                err => console.error('Error fetching queue information: ', err));
        });
    }, []);

    const addToQueue = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // run as transaction, to ensure atomic incrementing in queue and no 2 customers with same queue position
        runTransaction(db, async (transaction) => {
            const newMeta = await transaction.get(metadata);
            if(newMeta.exists()) {
                const newLastInQueue = newMeta.data().lastInQueue+1;
                transaction.update(metadata, {lastInQueue: newLastInQueue});
                addDoc(queueCollection, {
                    userName: userName,
                    position: newLastInQueue,
                    timestamp: serverTimestamp()
                }).then(
                    docRef => console.log('Document written with id: ', docRef.id),
                    error => console.error('Error adding customer to queue: ', error)
                );
            }
        });
        setUserName(""); // reset form
    }

    // for demo convenience only - should normally be moved to some backend api layer
    const incrementQueue = () => {
        runTransaction(db, async (transaction) => {
            const newMeta = await transaction.get(metadata);
            if(newMeta.exists()) {
                const newCurrentPosition = newMeta.data().currentPosition+1;
                transaction.update(metadata, {currentPosition: newCurrentPosition});
            }
        });
    }

    return (
        <div className="App">
            <header className="App-header">
                <span>MyQueue App</span>
                <div>
                    <form onSubmit={addToQueue}>
                        <input className="input-field" type="text" name="userName" placeholder="User name"
                               onChange={(e) => setUserName(e.target.value)} value={userName}/>
                        <button className='button-base' type="submit"> Add me to queue</button>
                    </form>
                </div>
                <h2> Currently waiting: </h2>
                <table id="queueData">
                    <tbody>
                    {queueSnapshot && queueSnapshot.map((customer, customerIdx) => <tr key={customerIdx}>
                        <td>{customer.userName}</td>
                    </tr>)}
                    </tbody>
                </table>
                {/*for demo purposes only*/}
                <button className='button-base' type="button" onClick={incrementQueue}> Next customer! </button>
            </header>
        </div>
    );
}

export default App;
